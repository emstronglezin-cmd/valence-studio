import dns from 'node:dns/promises';
import { parse } from 'csv-parse/sync';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';

// Domaines grand public, FAI et emails jetables strictement exclus
const EXCLUDED_CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'hotmail.fr', 'hotmail.co.uk', 'outlook.com', 'outlook.fr', 'live.com',
  'live.fr', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
  'protonmail.com', 'pm.me', 'tutanota.com', 'tuta.io', 'gmx.com', 'gmx.fr', 'gmx.de',
  'mail.com', 'yandex.com', 'yandex.ru', 'zoho.eu', 'orange.fr', 'wanadoo.fr', 'free.fr',
  'sfr.fr', 'neuf.fr', 'laposte.net', 'bbox.fr', 'numericable.fr', 'skynet.be', 'proximus.be',
  'bluewin.ch', 'videotron.ca', 'bell.net', 'comcast.net', 'verizon.net', 'att.net',
  'yopmail.com', 'yopmail.fr', 'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  '10minutemail.com', 'trashmail.com', 'sharklasers.com',
]);

// Préfixes génériques / fonctionnels d'entreprise autorisés (conformité B2B personne morale)
const ALLOWED_GENERIC_PREFIXES = new Set([
  'contact', 'contacts', 'info', 'infos', 'information', 'bonjour', 'hello', 'hi', 'welcome',
  'commercial', 'sales', 'vente', 'ventes', 'devis', 'partenariat', 'partenariats',
  'partnership', 'partnerships', 'partner', 'partners', 'support', 'help', 'aide',
  'serviceclient', 'service-client', 'customerservice', 'accueil', 'reception', 'office',
  'bureau', 'direction', 'general', 'admin', 'administration', 'secretariat', 'team',
  'equipe', 'presse', 'press', 'media', 'communication', 'marketing', 'b2b', 'pro',
  'entreprise', 'entreprises', 'corporate', 'export', 'international', 'achats',
  'procurement', 'agency', 'studio', 'legal',
]);

const RESERVED_INVALID_TLDS = new Set(['test', 'invalid', 'localhost', 'example', 'local']);

const EMAIL_SYNTAX_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function pickField(row, candidates) {
  for (const key of Object.keys(row)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (candidates.includes(normalizedKey)) {
      return String(row[key] ?? '').trim();
    }
  }
  return '';
}

function isValidDomainSyntax(domain) {
  if (!domain || domain.length > 253 || domain.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1].toLowerCase();
  if (!/^[a-z]{2,24}$/.test(tld) || RESERVED_INVALID_TLDS.has(tld)) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/i.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
  );
}

async function checkDomainDnsWithTimeout(domain, timeoutMs = 3500) {
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs);
    timer.unref?.();
  });

  const lookupPromise = (async () => {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (Array.isArray(mxRecords) && mxRecords.length > 0) {
        return { valid: true, mxVerified: true };
      }
    } catch (mxErr) {
      if (['ENOTFOUND', 'EBADNAME'].includes(mxErr.code)) {
        return { valid: false, mxVerified: false };
      }
    }

    // Repli RFC 5321 : un domaine sans MX explicite mais avec un enregistrement A/AAAA reste routable
    try {
      const aRecords = await dns.resolve4(domain);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        return { valid: true, mxVerified: false };
      }
    } catch {
      // ignore
    }

    return { valid: false, mxVerified: false };
  })();

  try {
    return await Promise.race([lookupPromise, timeoutPromise]);
  } catch {
    return { valid: false, mxVerified: false };
  }
}

function detectDelimiter(csvText) {
  const firstLine = (csvText.split(/\r?\n/)[0] || '').trim();
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export const b2bDirectoryService = {
  /**
   * Importe et nettoie un fichier CSV d'annuaire B2B :
   * - Validation stricte du format email
   * - Rejet des webmails personnels (gmail, yahoo, outlook, FAI...)
   * - Filtrage exclusif des adresses professionnelles génériques (contact@, info@, hello@...)
   * - Dédoublonnage intra-CSV et vis-à-vis de la base
   * - Validation syntaxique + DNS/MX du nom de domaine
   */
  async importFromCsvString(csvContent, { sourceBatch = 'manual_import', verifyDns = env.b2b.verifyDnsMx } = {}) {
    const cleanText = String(csvContent || '').replace(/^\uFEFF/, '').trim();
    if (!cleanText) {
      throw new Error('Le contenu CSV fourni est vide.');
    }

    const delimiter = detectDelimiter(cleanText);
    const records = parse(cleanText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter,
      relax_column_count: true,
    });

    const stats = {
      totalRows: records.length,
      inserted: 0,
      duplicatesInCsv: 0,
      duplicatesInDb: 0,
      rejectedInvalidFormat: 0,
      rejectedFreeWebmail: 0,
      rejectedNonGenericPersonal: 0,
      rejectedInvalidDomain: 0,
    };

    const rejectedSamples = [];
    const seenInCsv = new Set();
    const prevalidatedCandidates = [];

    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const lineNum = index + 2;

      const rawEmail = pickField(row, ['email', 'mail', 'courriel', 'emailpro', 'contactemail']);
      const email = rawEmail.toLowerCase().trim();
      const companyName =
        pickField(row, ['companyname', 'company', 'societe', 'entreprise', 'nom', 'organisation']) ||
        'Société B2B';
      const sector = pickField(row, ['sector', 'secteur', 'industry', 'categorie']) || 'Services B2B';
      const country = (pickField(row, ['country', 'pays', 'countrycode']) || 'INTL').toUpperCase().slice(0, 12);
      const city = pickField(row, ['city', 'ville']) || '';
      const website = pickField(row, ['website', 'site', 'siteweb', 'url']) || '';

      // 1. Contrôle syntaxique de l'email
      if (!email || email.length > 254 || email.includes('..') || !EMAIL_SYNTAX_REGEX.test(email)) {
        stats.rejectedInvalidFormat += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({ line: lineNum, email: rawEmail || '(vide)', reason: 'Format email invalide' });
        }
        continue;
      }

      const [localPart, domain] = email.split('@');

      // 2. Contrôle syntaxique du domaine
      if (!isValidDomainSyntax(domain)) {
        stats.rejectedInvalidDomain += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({ line: lineNum, email, reason: 'Syntaxe de domaine invalide' });
        }
        continue;
      }

      // 3. Rejet des webmails personnels / grand public
      if (EXCLUDED_CONSUMER_DOMAINS.has(domain)) {
        stats.rejectedFreeWebmail += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({
            line: lineNum,
            email,
            reason: 'Domaine webmail grand public exclu (B2B professionnel uniquement)',
          });
        }
        continue;
      }

      // 4. Contrôle strict du préfixe générique (ex: contact@, info@, hello@, commercial@)
      // Rejette toute adresse nominative de type prenom.nom@ ou initiale.nom@
      const normalizedPrefix = localPart.split('+')[0].toLowerCase();
      if (!ALLOWED_GENERIC_PREFIXES.has(normalizedPrefix)) {
        stats.rejectedNonGenericPersonal += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({
            line: lineNum,
            email,
            reason: 'Email nominatif ou non générique rejeté (seuls contact@, info@, hello@... sont admis)',
          });
        }
        continue;
      }

      // 5. Dédoublonnage intra-CSV
      if (seenInCsv.has(email)) {
        stats.duplicatesInCsv += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({ line: lineNum, email, reason: 'Doublon détecté dans le fichier CSV' });
        }
        continue;
      }
      seenInCsv.add(email);

      prevalidatedCandidates.push({
        lineNum,
        company_name: companyName.slice(0, 160),
        email,
        domain,
        role_prefix: normalizedPrefix,
        sector: sector.slice(0, 100),
        country,
        city: city.slice(0, 100) || null,
        website: website ? (website.startsWith('http') ? website : `https://${website}`) : `https://${domain}`,
        source_batch: sourceBatch,
      });
    }

    // 6. Dédoublonnage contre la base existante
    const existingEmails = await repository.getExistingB2BEmails(
      prevalidatedCandidates.map((c) => c.email)
    );

    const nonDuplicateCandidates = [];
    for (const candidate of prevalidatedCandidates) {
      if (existingEmails.has(candidate.email)) {
        stats.duplicatesInDb += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({
            line: candidate.lineNum,
            email: candidate.email,
            reason: 'Déjà présent dans la base Annuaire B2B',
          });
        }
      } else {
        nonDuplicateCandidates.push(candidate);
      }
    }

    // 7. Validation DNS / MX par domaine unique (avec cache et concurrence bornée)
    const uniqueDomains = [...new Set(nonDuplicateCandidates.map((c) => c.domain))];
    const domainStatusMap = new Map();

    if (verifyDns && uniqueDomains.length > 0) {
      const concurrency = 8;
      for (let i = 0; i < uniqueDomains.length; i += concurrency) {
        const batch = uniqueDomains.slice(i, i + concurrency);
        const results = await Promise.all(
          batch.map(async (dom) => [dom, await checkDomainDnsWithTimeout(dom)])
        );
        for (const [dom, res] of results) {
          domainStatusMap.set(dom, res);
        }
      }
    } else {
      for (const dom of uniqueDomains) {
        domainStatusMap.set(dom, { valid: true, mxVerified: false });
      }
    }

    const validToInsert = [];
    for (const candidate of nonDuplicateCandidates) {
      const dnsCheck = domainStatusMap.get(candidate.domain) || { valid: false, mxVerified: false };
      if (!dnsCheck.valid) {
        stats.rejectedInvalidDomain += 1;
        if (rejectedSamples.length < 25) {
          rejectedSamples.push({
            line: candidate.lineNum,
            email: candidate.email,
            reason: 'Domaine injoignable (aucun serveur DNS MX/A actif)',
          });
        }
        continue;
      }

      const { lineNum, ...cleanRow } = candidate;
      validToInsert.push({
        ...cleanRow,
        mx_verified: dnsCheck.mxVerified,
        quality_score: dnsCheck.mxVerified ? 100 : 85,
      });
    }

    const insertedRows = await repository.insertB2BContacts(validToInsert);
    stats.inserted = insertedRows.length;

    return {
      stats,
      rejectedSamples,
      insertedPreview: insertedRows.slice(0, 15),
    };
  },

  exportToCsv(contacts) {
    const headers = ['company_name', 'email', 'role_prefix', 'sector', 'country', 'city', 'website', 'mx_verified'];
    const escapeCsv = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of contacts) {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
    return lines.join('\n');
  },
};
