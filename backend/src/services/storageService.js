import crypto from 'node:crypto';
import path from 'node:path';
import { env } from '../config/env.js';
import { getSupabase } from '../db/supabase.js';
import { repository } from '../db/repository.js';

export function signDownloadToken(token) {
  return crypto
    .createHmac('sha256', env.appHmacSecret)
    .update(`download:${token}`)
    .digest('hex');
}

export function verifyDownloadSignature(token, candidateSig) {
  if (!token || !candidateSig || typeof candidateSig !== 'string') return false;
  const expectedHex = signDownloadToken(token);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = Buffer.from(candidateSig, 'hex');
  if (expectedBuf.length === 0 || expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Crée une URL signée expirante (24h par défaut, 3 téléchargements max par défaut)
 * pointant vers un fichier stocké dans Supabase Storage privé.
 */
export async function issueSignedProductDelivery({
  orderId,
  storagePath,
  fileName,
  ttlHours = env.delivery.ttlHours,
  maxDownloads = env.delivery.maxDownloads,
}) {
  const apiPrefix = env.hasExplicitBackendUrl ? env.backendPublicUrl : env.browserApiPrefix;
  const frontPrefix = env.hasExplicitFrontendUrl ? env.frontendPublicUrl : env.browserFrontendPrefix;

  const existing = orderId ? await repository.getDownloadTokenByOrderId(orderId) : null;
  if (existing) {
    const sig = signDownloadToken(existing.token);
    return {
      tokenRecord: existing,
      signature: sig,
      signedDownloadUrl: `${apiPrefix}/api/downloads/${existing.token}?sig=${sig}`,
      thankYouUrl: `${frontPrefix}/merci.html?token=${existing.token}&sig=${sig}`,
    };
  }

  const token = `dl_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const resolvedFileName = fileName || path.basename(storagePath) || 'valence-archive.zip';

  const tokenRecord = await repository.createDownloadToken({
    token,
    orderId,
    storagePath,
    fileName: resolvedFileName,
    maxDownloads,
    expiresAt,
  });

  const sig = signDownloadToken(token);
  return {
    tokenRecord,
    signature: sig,
    signedDownloadUrl: `${apiPrefix}/api/downloads/${token}?sig=${sig}`,
    thankYouUrl: `${frontPrefix}/merci.html?token=${token}&sig=${sig}`,
  };
}

/**
 * Consomme 1 crédit de téléchargement (max 3, validité 24h) puis génère une URL signée
 * éphémère (60 secondes) depuis le bucket privé Supabase Storage.
 */
export async function authorizeAndResolvePrivateFile(token, sig) {
  if (!verifyDownloadSignature(token, sig)) {
    return { ok: false, status: 403, error: 'Signature cryptographique du lien invalide.' };
  }

  const info = await repository.getDownloadTokenInfo(token);
  if (!info) {
    return { ok: false, status: 404, error: 'Lien de téléchargement introuvable.' };
  }

  if (new Date(info.expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      status: 410,
      error: `Ce lien de téléchargement a expiré (validité limitée à ${env.delivery.ttlHours} heures).`,
    };
  }

  if (info.download_count >= info.max_downloads) {
    return {
      ok: false,
      status: 410,
      error: `Quota maximal atteint (${info.max_downloads}/${info.max_downloads} téléchargements utilisés).`,
    };
  }

  const consumed = await repository.consumeDownloadSlot(token);
  if (!consumed) {
    return {
      ok: false,
      status: 410,
      error: 'Lien expiré ou quota de téléchargements épuisé.',
    };
  }

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.storage
      .from(env.supabase.storageBucket)
      .createSignedUrl(consumed.storage_path, 60, {
        download: consumed.file_name,
      });

    if (error || !data?.signedUrl) {
      throw new Error(
        `Erreur Supabase Storage (${env.supabase.storageBucket}/${consumed.storage_path}): ${
          error?.message || 'URL signée vide'
        }`
      );
    }

    return {
      ok: true,
      mode: 'redirect',
      signedStorageUrl: data.signedUrl,
      tokenRecord: consumed,
    };
  }

  // En mode aperçu local (avant connexion du bucket Supabase Storage), génère un livrable de démonstration
  const previewContent = [
    '====================================================================',
    'VALENCE STUDIO — LIVRABLE NUMÉRIQUE VÉRIFIÉ (APERÇU LOCAL)',
    '====================================================================',
    `Fichier cible Supabase Storage : ${env.supabase.storageBucket}/${consumed.storage_path}`,
    `Nom du fichier                 : ${consumed.file_name}`,
    `Téléchargements utilisés       : ${consumed.download_count} / ${consumed.max_downloads}`,
    `Expiration du lien (24h)       : ${consumed.expires_at}`,
    '',
    'Dès que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont configurés dans .env,',
    'cette route redirige automatiquement vers votre fichier privé Supabase Storage.',
    '====================================================================',
  ].join('\n');

  return {
    ok: true,
    mode: 'buffer',
    fileName: consumed.file_name.endsWith('.txt')
      ? consumed.file_name
      : `${consumed.file_name}.readme.txt`,
    mimeType: 'text/plain; charset=utf-8',
    buffer: Buffer.from(previewContent, 'utf8'),
    tokenRecord: consumed,
  };
}
