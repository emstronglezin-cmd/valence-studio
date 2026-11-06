import { env } from '../config/env.js';

const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function callGroqJson({ systemPrompt, userPrompt, temperature = 0.65 }) {
  const response = await fetch(GROQ_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.groq.model, // llama-3.3-70b-versatile
      temperature,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Groq API (${response.status}): ${errText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Réponse Groq vide.');
  }

  return JSON.parse(content);
}

export const groqService = {
  /**
   * Génère la séquence de 3 emails de nurturing (J+1, J+3, J+5) via Groq llama-3.3-70b-versatile.
   */
  async generateNurturingSequence({ firstName, locale = 'fr', storeUrl }) {
    const catalogueUrl = `${storeUrl || env.frontendPublicUrl}/catalogue.html`;
    const displayName = firstName ? firstName.trim() : '';

    if (!env.groq.isConfigured) {
      const salutation = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
      return [
        {
          stepDay: 1,
          subject: 'J+1 — Comment tirer 10x plus de valeur de votre Kit Opérateur',
          bodyHtml: `<p>${salutation}</p><p>Hier, vous avez téléchargé notre extrait gratuit. L'erreur la plus fréquente consiste à empiler des outils sans relier prospection, production et suivi financier.</p><p><strong>Action rapide de 10 minutes aujourd'hui :</strong> prenez les 3 premiers prompts de qualification du kit et appliquez-les à votre offre principale pour clarifier votre promesse B2B.</p><p>Si vous voulez aller plus loin, explorez notre architecture complète sur <a href="${catalogueUrl}" style="color:#2546F0;">le catalogue Valence Studio</a>.</p>`,
          bodyText: `${salutation}\n\nHier, vous avez téléchargé notre extrait gratuit. Prenez 10 minutes aujourd'hui pour appliquer les 3 premiers prompts de qualification à votre offre.\n\nCatalogue complet : ${catalogueUrl}`,
        },
        {
          stepDay: 3,
          subject: 'J+3 — Étude de cas : structurer un pipeline international sans recruter',
          bodyHtml: `<p>${salutation}</p><p>Les studios et consultants qui vendent en Europe et en Amérique du Nord partagent un point commun : leurs livrables, leurs relances et leur base de prospection B2B suivent des SOP standardisées.</p><p>C'est exactement pour cela que nous avons conçu l'<strong>Operating System Notion</strong> et l'<strong>Annuaire B2B Vérifié</strong> (uniquement des contacts génériques personnes morales avec domaines MX validés).</p><p><a href="${catalogueUrl}" style="color:#2546F0;font-weight:600;">Découvrir les systèmes complets &rarr;</a></p>`,
          bodyText: `${salutation}\n\nStandardiser vos SOP et votre base B2B permet d'opérer à l'international sans friction.\n\nDécouvrir nos systèmes complets : ${catalogueUrl}`,
        },
        {
          stepDay: 5,
          subject: 'J+5 — Quel actif numérique activer en priorité cette semaine ?',
          bodyHtml: `<p>${salutation}</p><p>Pour clôturer cette courte série, voici comment choisir le bon levier selon votre priorité immédiate :</p><ul><li><strong>Structurer vos opérations clients :</strong> Operating System Notion (TPL-01)</li><li><strong>Accélérer votre production &amp; SEO :</strong> Matrice 450+ Prompts (PRM-01)</li><li><strong>Alimenter votre prospection B2B :</strong> Annuaire 2 500 sociétés vérifiées (DIR-01)</li></ul><p><a href="${catalogueUrl}" style="display:inline-block;padding:12px 20px;background:#2546F0;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">Accéder au catalogue Valence Studio</a></p>`,
          bodyText: `${salutation}\n\nChoisissez votre prochain levier :\n- Opérations : Operating System Notion\n- IA & SEO : Matrice 450+ Prompts\n- Prospection : Annuaire B2B Vérifié\n\nCatalogue : ${catalogueUrl}`,
        },
      ];
    }

    const systemPrompt = `Tu es un directeur copywriting B2B senior pour la marque internationale "Valence Studio" (${env.groq.niche}).
Génère en JSON strict une séquence de 3 emails de nurturing sobres, utiles et orientés conversion douce pour J+1, J+3 et J+5 après le téléchargement d'un extrait gratuit.
Langue : ${locale === 'en' ? 'anglais' : 'français'}.
Format JSON attendu :
{
  "emails": [
    {
      "stepDay": 1,
      "subject": "...",
      "bodyHtml": "<p>...</p>",
      "bodyText": "..."
    },
    { "stepDay": 3, "subject": "...", "bodyHtml": "...", "bodyText": "..." },
    { "stepDay": 5, "subject": "...", "bodyHtml": "...", "bodyText": "..." }
  ]
}`;

    const userPrompt = `Prénom de l'inscrit : "${displayName || 'Opérateur'}".
URL du catalogue à intégrer proprement dans l'appel à l'action : ${catalogueUrl}.
J+1 : conseil méthodologique actionnable immédiatement.
J+3 : preuve par l'architecture / étude de cas B2B internationale.
J+5 : orientation claire vers les produits du catalogue (templates, guides, packs de prompts, annuaire B2B).`;

    const data = await callGroqJson({ systemPrompt, userPrompt, temperature: 0.6 });
    const rawEmails = Array.isArray(data.emails) ? data.emails : [];
    const expectedDays = [1, 3, 5];

    return expectedDays.map((day, index) => {
      const item = rawEmails.find((e) => Number(e.stepDay) === day) || rawEmails[index] || {};
      return {
        stepDay: day,
        subject: String(item.subject || `Jour +${day} — Protocole Valence Studio`),
        bodyHtml: String(item.bodyHtml || `<p>Découvrez nos ressources sur <a href="${catalogueUrl}">${catalogueUrl}</a>.</p>`),
        bodyText: String(item.bodyText || `Découvrez nos ressources : ${catalogueUrl}`),
      };
    });
  },

  /**
   * Génère le pack quotidien d'acquisition :
   * - 3 idées de posts
   * - 1 article SEO complet (titre, meta, plan, texte HTML/Markdown, FAQ JSON-LD)
   * - 3 scripts de vidéos courtes TikTok/Reels (accroche 3s, corps, CTA)
   */
  async generateDailyAcquisitionPack({ generationDate, recentSlugs = [] }) {
    if (!env.groq.isConfigured) {
      const slug = `systeme-acquisition-produits-digitaux-${generationDate}`;
      return {
        postIdeas: [
          {
            channel: 'LinkedIn',
            hook: 'Pourquoi un produit numérique à 79 € bien documenté surpasse 10 appels de prospection à froid.',
            body: "Un actif numérique résout un problème précis en moins de 30 minutes.\n\nLorsqu'un dirigeant télécharge un template ou un playbook qui lui fait gagner une journée entière dès le premier jour, la confiance envers votre studio devient immédiate.\n\n3 critères d'un produit numérique B2B qui se vend à l'international :\n1. Zéro friction d'installation\n2. Bilingue ou universel par design\n3. Adossé à des procédures opérationnelles réelles.",
            cta: 'Découvrez notre extrait gratuit de 25 prompts et SOP sur Valence Studio.',
          },
          {
            channel: 'X / Threads',
            hook: 'La vraie différence entre un prompt amateur et un prompt de production en 4 lignes :',
            body: '1. Rôle métier précis + contraintes négatives\n2. Variables typées en entrée\n3. Structure de sortie JSON vérifiable\n4. Critères de contrôle qualité intégrés.',
            cta: 'La matrice complète de 450+ prompts est disponible dans le catalogue.',
          },
          {
            channel: 'LinkedIn',
            hook: 'Constituer un annuaire B2B propre sans jamais toucher aux données personnelles sensibles :',
            body: "Inutile d'acheter des listes douteuses.\nEn ciblant exclusivement les adresses génériques de personnes morales (contact@, hello@, commercial@) et en vérifiant systématiquement les enregistrements MX du domaine, vous protégez votre délivrabilité et restez irréprochable.",
            cta: 'Consultez notre méthodologie sur le blog Valence Studio.',
          },
        ],
        seoArticle: {
          slug,
          title: `Architecture de croissance ${generationDate} : vendre ses templates, guides et prompts B2B à l'international`,
          metaTitle: `Vendre des Produits Numériques B2B à l'International — Plan ${generationDate}`,
          metaDescription:
            'Plan opérationnel complet pour distribuer des templates, guides, packs de prompts IA et annuaires B2B avec SEO structuré et livraison sécurisée.',
          keywords: [
            'vendre produits numériques B2B',
            'templates notion agence',
            'pack de prompts IA',
            'annuaire B2B vérifié',
          ],
          outline: [
            '1. Structurer une gamme cohérente d’actifs numériques',
            '2. Automatiser la capture de leads par double opt-in',
            '3. Industrialiser le référencement naturel avec données structurées',
          ],
          contentMarkdown: `## 1. Structurer une gamme cohérente d'actifs numériques\n\nUne boutique autonome performante articule des produits complémentaires : templates opérationnels, guides méthodologiques, prompts d'automatisation et données B2B qualifiées.\n\n## 2. Automatiser la capture de leads par double opt-in\n\nOffrir un extrait gratuit vérifié transforme le trafic organique en audience propriétaire qualifiée.\n\n## 3. Industrialiser le SEO structuré\n\nChaque article enrichi de balises Schema.org capte une intention de recherche durable.`,
          contentHtml: `<h2>1. Structurer une gamme cohérente d'actifs numériques</h2><p>Une boutique autonome performante articule quatre piliers complémentaires : des <strong>templates opérationnels</strong> prêts à dupliquer, des <strong>guides d'exécution</strong> approfondis, des <strong>matrices de prompts IA</strong> calibrées pour l'automatisation et un <strong>annuaire B2B vérifié</strong>.</p><h2>2. Automatiser la capture de leads par double opt-in</h2><p>Plutôt que de laisser repartir 97 % des visiteurs anonymes, proposer un extrait concret en échange d'un email confirmé par double opt-in alimente chaque jour votre séquence de nurturing J+1, J+3 et J+5.</p><h2>3. Industrialiser le référencement naturel avec données structurées</h2><p>L'ajout systématique de métadonnées OpenGraph, d'un fichier <code>sitemap.xml</code> à jour et d'un balisage <code>Article</code> / <code>FAQPage</code> maximise la visibilité organique internationale.</p>`,
          faqItems: [
            {
              question: 'Comment protéger les fichiers numériques après paiement ?',
              answer:
                'En stockant les archives sur un bucket privé et en délivrant une URL signée expirant sous 24 heures et limitée à 3 téléchargements.',
            },
          ],
          readingTimeMinutes: 5,
        },
        shortVideoScripts: [
          {
            hook3s:
              'Arrêtez de vendre uniquement votre temps : voici comment packager vos méthodes en actifs numériques B2B.',
            body: "Chaque mission client vous oblige à recréer des tableaux de suivi, des prompts et des listes d'entreprises. Nettoyez-les, documentez-les en français et en anglais, et proposez-les en téléchargement instantané sécurisé.",
            cta: 'Lien en bio pour récupérer gratuitement notre Kit Opérateur de démarrage.',
          },
          {
            hook3s:
              '3 erreurs qui détruisent la délivrabilité de vos emails de prospection B2B en 2026.',
            body: 'Numéro 1 : écrire à des adresses gmail ou nominatives non vérifiées. Numéro 2 : oublier de tester le serveur MX du domaine. Numéro 3 : négliger le double opt-in sur votre propre newsletter.',
            cta: 'Téléchargez notre checklist complète sur Valence Studio.',
          },
          {
            hook3s:
              'Voici comment cette boutique génère ses propres clients pendant que je travaille sur les produits.',
            body: "Chaque matin à 7h, un agent IA prépare un article SEO structuré, trois scripts vidéos et accompagne les nouveaux inscrits sur 5 jours avec des conseils concrets avant de présenter le catalogue.",
            cta: 'Testez l’extrait gratuit directement depuis le site.',
          },
        ],
      };
    }

    const systemPrompt = `Tu es l'Agent d'Acquisition Éditorial Senior de "Valence Studio", boutique internationale de produits numériques (${env.groq.niche}).
Produis en JSON strict et complet le pack marketing quotidien en français irréprochable, orienté opérateurs B2B exigeants.
Slugs déjà existants à ne pas réutiliser : ${recentSlugs.slice(0, 15).join(', ') || 'aucun'}.
Schéma JSON obligatoire :
{
  "postIdeas": [
    { "channel": "LinkedIn", "hook": "...", "body": "...", "cta": "..." },
    { "channel": "X / Threads", "hook": "...", "body": "...", "cta": "..." },
    { "channel": "LinkedIn", "hook": "...", "body": "...", "cta": "..." }
  ],
  "seoArticle": {
    "slug": "mot-cle-principal-b2b",
    "title": "...",
    "metaTitle": "... (max 65 caractères)",
    "metaDescription": "... (max 158 caractères)",
    "keywords": ["...", "...", "..."],
    "outline": ["1. ...", "2. ...", "3. ...", "4. ..."],
    "contentMarkdown": "## 1. ...\n\n...",
    "contentHtml": "<h2>1. ...</h2><p>...</p>...",
    "faqItems": [
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." }
    ],
    "readingTimeMinutes": 6
  },
  "shortVideoScripts": [
    { "hook3s": "Accroche percutante des 3 premières secondes", "body": "Développement rythmé 25-40s", "cta": "Appel à l'action final" },
    { "hook3s": "...", "body": "...", "cta": "..." },
    { "hook3s": "...", "body": "...", "cta": "..." }
  ]
}`;

    const userPrompt = `Date du digest : ${generationDate}.
Génère exactement :
1) 3 idées de posts à haute valeur ajoutée ;
2) 1 article SEO de fond (minimum 500 mots dans contentHtml avec balises <h2>, <p>, <ul>, <li>, <strong>) ciblant une requête à fort potentiel d'achat pour nos templates, guides, packs de prompts IA ou notre annuaire B2B ;
3) 3 scripts de vidéos courtes TikTok / Reels avec accroche 3 secondes, corps et appel à l'action.`;

    const result = await callGroqJson({ systemPrompt, userPrompt, temperature: 0.7 });
    const rawArt = result.seoArticle || {};
    const safeSlug = slugify(rawArt.slug || rawArt.title || `article-seo-${generationDate}`);

    return {
      postIdeas: Array.isArray(result.postIdeas) ? result.postIdeas.slice(0, 3) : [],
      seoArticle: {
        slug: `${safeSlug}-${generationDate.slice(5)}`,
        title: String(rawArt.title || `Guide Opérateur B2B — ${generationDate}`),
        metaTitle: String(rawArt.metaTitle || rawArt.title || 'Valence Studio').slice(0, 70),
        metaDescription: String(
          rawArt.metaDescription || 'Ressources numériques B2B, prompts IA et systèmes Notion.'
        ).slice(0, 165),
        keywords: Array.isArray(rawArt.keywords) ? rawArt.keywords : [],
        outline: Array.isArray(rawArt.outline) ? rawArt.outline : [],
        contentMarkdown: String(rawArt.contentMarkdown || ''),
        contentHtml: String(rawArt.contentHtml || '<p>Contenu généré.</p>'),
        faqItems: Array.isArray(rawArt.faqItems) ? rawArt.faqItems : [],
        readingTimeMinutes: Number(rawArt.readingTimeMinutes) || 6,
      },
      shortVideoScripts: Array.isArray(result.shortVideoScripts)
        ? result.shortVideoScripts.slice(0, 3)
        : [],
    };
  },
};
