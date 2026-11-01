export const CATEGORY_LABELS = {
  fr: {
    all: 'Tout le catalogue',
    templates: 'Templates & Systèmes',
    guides: 'Guides & Playbooks',
    prompts: 'Packs de Prompts IA',
    directory: 'Annuaires B2B Vérifiés',
  },
  en: {
    all: 'All Products',
    templates: 'Templates & Systems',
    guides: 'Guides & Playbooks',
    prompts: 'AI Prompt Packs',
    directory: 'Verified B2B Directories',
  },
};

export function renderCategorySchematicSvg(category, code = '') {
  if (category === 'templates') {
    return `<svg viewBox="0 0 360 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-36 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5" aria-hidden="true">
      <rect x="20" y="20" width="96" height="130" rx="8" stroke="currentColor" stroke-opacity="0.18"/>
      <rect x="30" y="34" width="54" height="7" rx="3.5" fill="currentColor" fill-opacity="0.25"/>
      <rect x="30" y="50" width="72" height="5" rx="2.5" fill="currentColor" fill-opacity="0.12"/>
      <rect x="30" y="62" width="64" height="5" rx="2.5" fill="currentColor" fill-opacity="0.12"/>
      <rect x="130" y="20" width="210" height="58" rx="8" stroke="currentColor" stroke-opacity="0.18"/>
      <circle cx="150" cy="49" r="10" fill="#2546F0" fill-opacity="0.22" stroke="#2546F0"/>
      <rect x="170" y="42" width="110" height="6" rx="3" fill="currentColor" fill-opacity="0.3"/>
      <rect x="170" y="54" width="76" height="5" rx="2.5" fill="currentColor" fill-opacity="0.14"/>
      <rect x="130" y="92" width="100" height="58" rx="8" stroke="currentColor" stroke-opacity="0.18"/>
      <rect x="240" y="92" width="100" height="58" rx="8" stroke="#2546F0" stroke-opacity="0.45" fill="#2546F0" fill-opacity="0.06"/>
      <text x="252" y="125" fill="currentColor" fill-opacity="0.65" font-family="monospace" font-size="11">${code || 'SYSTEM'}</text>
    </svg>`;
  }
  if (category === 'guides') {
    return `<svg viewBox="0 0 360 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-36 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5" aria-hidden="true">
      <rect x="64" y="18" width="232" height="134" rx="10" stroke="currentColor" stroke-opacity="0.2"/>
      <line x1="112" y1="18" x2="112" y2="152" stroke="currentColor" stroke-opacity="0.14"/>
      <rect x="130" y="38" width="128" height="8" rx="4" fill="#2546F0" fill-opacity="0.75"/>
      <rect x="130" y="56" width="144" height="5" rx="2.5" fill="currentColor" fill-opacity="0.22"/>
      <rect x="130" y="68" width="136" height="5" rx="2.5" fill="currentColor" fill-opacity="0.14"/>
      <rect x="130" y="80" width="118" height="5" rx="2.5" fill="currentColor" fill-opacity="0.14"/>
      <rect x="130" y="104" width="90" height="26" rx="6" fill="#2546F0" fill-opacity="0.1" stroke="#2546F0" stroke-opacity="0.4"/>
      <text x="76" y="46" fill="currentColor" fill-opacity="0.5" font-family="monospace" font-size="10">${code || 'BOOK'}</text>
    </svg>`;
  }
  if (category === 'prompts') {
    return `<svg viewBox="0 0 360 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-36 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5" aria-hidden="true">
      <rect x="24" y="22" width="312" height="126" rx="10" stroke="currentColor" stroke-opacity="0.2"/>
      <circle cx="42" cy="38" r="3.5" fill="currentColor" fill-opacity="0.28"/>
      <circle cx="54" cy="38" r="3.5" fill="currentColor" fill-opacity="0.28"/>
      <circle cx="66" cy="38" r="3.5" fill="#2546F0"/>
      <line x1="24" y1="52" x2="336" y2="52" stroke="currentColor" stroke-opacity="0.12"/>
      <text x="40" y="76" fill="#2546F0" font-family="monospace" font-size="11">{ "role": "system",</text>
      <text x="40" y="96" fill="currentColor" fill-opacity="0.65" font-family="monospace" font-size="11">  "variables": ["audience", "proof"],</text>
      <text x="40" y="116" fill="currentColor" fill-opacity="0.45" font-family="monospace" font-size="11">  "output": "structured_json" }</text>
    </svg>`;
  }
  return `<svg viewBox="0 0 360 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-36 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5" aria-hidden="true">
    <rect x="22" y="24" width="316" height="28" rx="6" fill="#2546F0" fill-opacity="0.1" stroke="#2546F0" stroke-opacity="0.35"/>
    <text x="34" y="42" fill="currentColor" fill-opacity="0.75" font-family="monospace" font-size="10">COMPANY          EMAIL               MX_DNS</text>
    <rect x="22" y="60" width="316" height="24" rx="5" stroke="currentColor" stroke-opacity="0.14"/>
    <text x="34" y="76" fill="currentColor" fill-opacity="0.6" font-family="monospace" font-size="10">Stripe Europe    info@stripe.com     VERIFIED</text>
    <rect x="22" y="90" width="316" height="24" rx="5" stroke="currentColor" stroke-opacity="0.14"/>
    <text x="34" y="106" fill="currentColor" fill-opacity="0.6" font-family="monospace" font-size="10">Brevo SAS        contact@brevo.com   VERIFIED</text>
    <rect x="22" y="120" width="316" height="24" rx="5" stroke="currentColor" stroke-opacity="0.14"/>
    <text x="34" y="136" fill="currentColor" fill-opacity="0.6" font-family="monospace" font-size="10">Linear Orbit     hello@linear.app    VERIFIED</text>
  </svg>`;
}

export const FALLBACK_PRODUCTS = [
  {
    slug: 'notion-agency-os',
    code: 'TPL-01',
    category: 'templates',
    title_fr: 'Operating System Notion — Studio & Agence Internationale',
    title_en: 'Notion Operating System — International Studio & Agency',
    subtitle_fr:
      'CRM B2B, pipeline multi-devises, suivi livrables, portail client et trésorerie automatisée.',
    subtitle_en:
      'B2B CRM, multi-currency pipeline, delivery tracker, client portal, and automated cashflow.',
    description_fr:
      "Conçu pour les freelances seniors, studios créatifs et agences opérant à l'international. Ce système Notion unifie votre prospection B2B, vos propositions commerciales, la gestion des sprints clients et la facturation multi-devises (EUR/USD/GBP) en une architecture claire, prête en 15 minutes.",
    description_en:
      'Engineered for senior freelancers, creative studios, and international agencies. Unify B2B pipeline, proposals, client portals, sprint delivery, and multi-currency tracking in 15 minutes.',
    price_cents_eur: 7900,
    price_cents_usd: 8500,
    file_format: 'ZIP (Template Notion + SOP PDF + Automatisations Make/Webhook)',
    file_size_label: '18.4 MB',
    version: '3.2.0',
    featured: true,
    badge_fr: 'Best-seller',
    badge_en: 'Best-seller',
    highlights: [
      '14 bases de données relationnelles pré-liées',
      'Portail client partageable en 1 clic (FR & EN)',
      'Calculateur de rentabilité projet et TJM cible',
      'Mises à jour mineures et majeures incluses',
    ],
    preview_items: [
      {
        title: 'Vue Direction & Cashflow',
        detail: "Projection à 90 jours du chiffre d'affaires signé, pondéré et encaissé.",
      },
      {
        title: 'Portail Client Marque Blanche',
        detail: 'Espace dédié par client : jalons, validations, livrables et compte-rendus.',
      },
      {
        title: "SOP d'Onboarding",
        detail: '12 procédures documentées prêtes à dupliquer pour déléguer sans friction.',
      },
    ],
    faqs: [
      {
        q: "Ai-je besoin d'un abonnement Notion payant ?",
        a: 'Non, le système fonctionne intégralement sur un compte Notion gratuit (Personal/Free).',
      },
      {
        q: 'Le template est-il disponible en français et en anglais ?',
        a: "Oui, l'archive contient les deux versions complètes (FR et EN) pour travailler avec vos clients internationaux.",
      },
      {
        q: 'Comment se déroule la livraison après paiement ?',
        a: 'Immédiatement après confirmation du paiement, Brevo vous transmet un lien privé signé valable 24 heures (3 téléchargements maximum).',
      },
    ],
  },
  {
    slug: 'playbook-acquisition-ia-b2b',
    code: 'GDE-01',
    category: 'guides',
    title_fr: "Playbook Ingénierie d'Acquisition B2B & Systèmes IA",
    title_en: 'B2B Acquisition Engineering & AI Systems Playbook',
    subtitle_fr:
      "210 pages d'architecture concrète : SEO programmatique, séquences d'emails, positionnement et conversion.",
    subtitle_en:
      '210 pages of actionable systems: programmatic SEO, outbound workflows, positioning, and conversion.',
    description_fr:
      "Un manuel d'exécution sans théorie superflue. Découvrez comment bâtir un moteur d'acquisition organique et sortant qui génère des opportunités qualifiées chaque semaine grâce aux workflows IA, au référencement structuré et aux séquences de nurturing à haute délivrabilité.",
    description_en:
      'A pure execution manual. Build a repeatable organic and outbound acquisition engine powered by structured SEO, high-deliverability email workflows, and precision AI prompts.',
    price_cents_eur: 5900,
    price_cents_usd: 6400,
    file_format: 'PDF Haute Définition + EPUB + 18 Schémas Architecture SVG',
    file_size_label: '24.1 MB',
    version: '2.1.0',
    featured: true,
    badge_fr: 'Édition 2026',
    badge_en: '2026 Edition',
    highlights: [
      '210 pages structurées en 9 protocoles opérationnels',
      'Checklists DNS (SPF, DKIM, DMARC) et délivrabilité',
      "Modèles de pages de vente et d'audit de conversion",
      'Exemples chiffrés B2B France, Europe et Amérique du Nord',
    ],
    preview_items: [
      {
        title: 'Chapitre 01 — Positionnement & Offre Irrésistible',
        detail: 'Découper votre expertise en actifs scalables et offres productisées.',
      },
      {
        title: 'Chapitre 04 — Machine SEO & Contenu Structuré',
        detail: 'Architecture cocon sémantique, données structurées JSON-LD et maillage interne.',
      },
      {
        title: 'Chapitre 07 — Séquences Nurturing J+1 / J+3 / J+5',
        detail: 'Anatomie exacte des emails qui transforment un inscrit froid en acheteur.',
      },
    ],
    faqs: [
      {
        q: "À qui s'adresse ce guide ?",
        a: "Aux fondateurs SaaS, consultants B2B, agences et créateurs de produits numériques souhaitant un système d'acquisition prévisible.",
      },
      {
        q: 'Les frameworks sont-ils applicables hors marché francophone ?',
        a: "Absolument : tous les modèles d'emails et de landing pages sont fournis en français et en anglais.",
      },
    ],
  },
  {
    slug: 'pack-prompts-operateur-elite',
    code: 'PRM-01',
    category: 'prompts',
    title_fr: 'Matrice 450+ Prompts Ingénierie Commerciale, SEO & Produit',
    title_en: '450+ Prompt Matrix — Revenue Engineering, SEO & Product',
    subtitle_fr:
      'Bibliothèque structurée avec variables système pour Claude, GPT-4o et Llama 3.3 (Groq).',
    subtitle_en:
      'Structured system-prompt library engineered for Claude, GPT-4o, and Llama 3.3 (Groq).',
    description_fr:
      "Oubliez les prompts génériques d'une ligne. Cette bibliothèque rassemble 450 architectures de prompts multi-étapes (System Role, Contraintes, Exemples Few-Shot, Format de sortie JSON/Markdown) testées en production pour la rédaction SEO, le copywriting, l'analyse concurrentielle et l'automatisation.",
    description_en:
      'Forget one-line generic prompts. Access 450 multi-stage prompt architectures tested in production for SEO editorial, conversion copywriting, competitive analysis, and API automation.',
    price_cents_eur: 4900,
    price_cents_usd: 5400,
    file_format: 'JSON + Base Notion + Markdown + CSV API-Ready',
    file_size_label: '9.6 MB',
    version: '4.0.0',
    featured: true,
    badge_fr: 'Compatible API & Groq',
    badge_en: 'API & Groq Ready',
    highlights: [
      '450 prompts catégorisés en 12 départements métier',
      'Version JSON prête à injecter dans vos scripts Node.js / Python',
      'Variables dynamiques typées {{audience}}, {{offre}}, {{preuve}}',
      'Zéro remplissage : uniquement des prompts testés sur vrais livrables',
    ],
    preview_items: [
      {
        title: 'Module Acquisition & Copywriting (120 prompts)',
        detail: 'Pages de vente, hooks vidéos 3 secondes, séquences email et annonces.',
      },
      {
        title: 'Module SEO & Editorial Long-Form (95 prompts)',
        detail: 'Briefs sémantiques, articles 2 000 mots, FAQ Schema.org et réécriture.',
      },
      {
        title: 'Module Stratégie, Pricing & Produit (110 prompts)',
        detail: "Analyse d'objections, structuration d'offres B2B et scripts de découverte.",
      },
    ],
    faqs: [
      {
        q: "Sur quels modèles d'IA ces prompts fonctionnent-ils ?",
        a: 'Ils sont optimisés et testés sur Claude, ChatGPT, Gemini et Llama-3.3-70B via Groq.',
      },
      {
        q: 'Puis-je les intégrer dans mes propres automatisations ?',
        a: "Oui, la licence inclut l'usage commercial interne dans vos workflows Make, n8n ou scripts backend.",
      },
    ],
  },
  {
    slug: 'annuaire-b2b-international-verifie',
    code: 'DIR-01',
    category: 'directory',
    title_fr: 'Annuaire B2B Vérifié — 2 500 Sociétés Tech, E-Commerce & Agences',
    title_en: 'Verified B2B Directory — 2,500 Tech, E-Commerce & Agency Companies',
    subtitle_fr:
      'Exclusivement des emails génériques professionnels (contact@, info@, hello@) avec domaines MX vérifiés.',
    subtitle_en:
      'Strictly corporate role-based emails (contact@, info@, hello@) with verified MX domains.',
    description_fr:
      "Gagnez des centaines d'heures de recherche commerciale. Cet annuaire B2B international répertorie 2 500 entreprises actives filtrées par notre pipeline de contrôle qualité : aucun webmail personnel, aucune donnée nominative sensible, dédoublonnage strict et enregistrements DNS/MX vérifiés.",
    description_en:
      'Save hundreds of hours of B2B research. 2,500 active companies filtered through our automated quality pipeline: zero free webmails, zero personal data, deduplicated, and MX-verified.',
    price_cents_eur: 12900,
    price_cents_usd: 13900,
    file_format: 'CSV UTF-8 + Excel (.xlsx) + Guide Prospection B2B Conforme',
    file_size_label: '6.8 MB',
    version: '2026.Q4',
    featured: true,
    badge_fr: 'Conformité B2B RGPD',
    badge_en: 'GDPR Corporate Safe',
    highlights: [
      '2 500 entreprises qualifiées (France, Belgique, Suisse, Canada, UK, USA)',
      "100 % d'adresses personnes morales génériques (contact@, bonjour@, hello@...)",
      'Contrôle syntaxique, anti-doublon et validation DNS/MX effectués',
      'Colonnes : Société, Secteur, Pays, Ville, Site Web, Email générique',
    ],
    preview_items: [
      {
        title: 'Segmentation Sectorielle Fine',
        detail: 'SaaS B2B, Studios Digitaux, Marques D2C, Cabinets Conseil et EdTech.',
      },
      {
        title: 'Hygiène de Données Maximale',
        detail: 'Exclusion totale des domaines gmail/outlook/yahoo et adresses nominatives.',
      },
      {
        title: 'Import Immédiat CRM',
        detail: 'Formaté nativement pour HubSpot, Pipedrive, Brevo, Lemlist et Notion.',
      },
    ],
    faqs: [
      {
        q: 'Cet annuaire respecte-t-il les règles de prospection B2B ?',
        a: 'Oui : il ne comporte aucune adresse personnelle nominative ni webmail privé, uniquement des coordonnées génériques publiques de personnes morales.',
      },
    ],
  },
  {
    slug: 'ui-kit-tailwind-landing-conversion',
    code: 'TPL-02',
    category: 'templates',
    title_fr: 'Architecture UI Tailwind & GSAP — 18 Sections Haute Conversion',
    title_en: 'Tailwind & GSAP UI Architecture — 18 High-Conversion Sections',
    subtitle_fr:
      'Composants HTML/Tailwind ultra-légers (Lighthouse 98+) avec micro-interactions GSAP et mode sombre natif.',
    subtitle_en:
      'Ultra-light HTML/Tailwind components (Lighthouse 98+) with GSAP micro-interactions and native dark mode.',
    description_fr:
      "Lancez des pages produits numériques et SaaS d'un niveau studio sans framework lourd. 18 blocs modulaires prêts à copier-coller, accessibles au clavier, compatibles prefers-reduced-motion et optimisés pour GitHub Pages.",
    description_en:
      'Ship studio-grade SaaS and digital product pages without heavy frameworks. 18 modular sections with native dark/light polarity and accessible GSAP motion.',
    price_cents_eur: 6500,
    price_cents_usd: 6900,
    file_format: 'ZIP (HTML5 + CSS + Modules JS GSAP + Tokens Figma)',
    file_size_label: '11.2 MB',
    version: '1.8.0',
    featured: false,
    badge_fr: 'Lighthouse 98+',
    badge_en: 'Lighthouse 98+',
    highlights: [
      'Zéro dépendance lourde : pur HTML + Tailwind + GSAP',
      'Thème sombre et clair automatique selon les préférences système',
      'Grilles Bento, tableaux comparatifs, FAQ accessibles et cartes 3D',
      'Licence multi-projets commerciaux incluse',
    ],
    preview_items: [
      {
        title: 'Système Typographique & Couleurs',
        detail: 'Variables CSS sémantiques prêtes à adapter à votre identité en 2 minutes.',
      },
    ],
    faqs: [
      {
        q: "Puis-je l'héberger gratuitement sur GitHub Pages ?",
        a: "Oui, l'architecture est 100 % statique et se déploie en quelques secondes sur GitHub Pages.",
      },
    ],
  },
  {
    slug: 'guide-pricing-international-produits-digitaux',
    code: 'GDE-02',
    category: 'guides',
    title_fr: 'Guide Pricing, Fiscalité & Distribution Internationale des Actifs Digitaux',
    title_en: 'International Digital Products Pricing, Tax & Distribution Guide',
    subtitle_fr:
      'Structurer vos paliers tarifaires EUR/USD, conformité TVA numérique, preuves sociales et upsells.',
    subtitle_en:
      'Structure EUR/USD pricing tiers, digital VAT rules, conversion psychology, and high-margin bundles.',
    description_fr:
      "Un condensé stratégique de 135 pages pour vendre vos templates, guides et bases de données au-delà de votre marché domestique. Couvre la psychologie des prix en devises multiples et l'optimisation du panier moyen.",
    description_en:
      'A 135-page strategic handbook to scale digital products globally across currencies, legal frameworks, and conversion funnels.',
    price_cents_eur: 4500,
    price_cents_usd: 4900,
    file_format: 'PDF + Calculateur Excel/Numbers de Marge & Prix',
    file_size_label: '14.3 MB',
    version: '1.4.0',
    featured: false,
    badge_fr: 'Nouveau',
    badge_en: 'New',
    highlights: [
      'Matrice de tarification internationale EUR / USD',
      'Clauses types de fourniture immédiate du contenu numérique',
      'Modèle financier Visites -> Leads -> Ventes',
    ],
    preview_items: [
      {
        title: 'Architecture de Gamme en 3 Paliers',
        detail: 'Produit d’appel, offre cœur de gamme et pack licence équipe/agence.',
      },
    ],
    faqs: [
      {
        q: 'Le calculateur Excel fonctionne-t-il sur Google Sheets ?',
        a: 'Oui, les formats .xlsx et Google Sheets sont tous deux inclus.',
      },
    ],
  },
];

export const FALLBACK_ARTICLES = [
  {
    slug: 'automatiser-acquisition-b2b-produits-numeriques',
    title:
      "Comment bâtir un système d'acquisition autonome pour vendre des produits numériques à l'international",
    meta_title:
      'Acquisition B2B Autonome pour Produits Numériques : Architecture Complète (2026)',
    meta_description:
      'Découvrez comment combiner un lead magnet double opt-in, une séquence nurturing IA et le SEO éditorial pour générer des ventes récurrentes de produits numériques.',
    reading_time_minutes: 6,
    published_at: '2026-10-28T07:00:00.000Z',
    outline: [
      '1. Pourquoi 90 % des boutiques de templates plafonnent faute de moteur organique',
      "2. L'architecture triptyque : SEO structuré, Lead Magnet concret et Nurturing J+1/J+3/J+5",
      '3. Sécuriser la délivrabilité internationale et la conformité RGPD',
    ],
    content_html: `<p>Créer un excellent template Notion, un guide technique ou un pack de prompts ne représente que la moitié de l'équation. Associer une vitrine rapide à un agent d'acquisition quotidien permet d'attirer un trafic qualifié durable.</p>`,
    faq_items: [],
  },
  {
    slug: 'structurer-annuaire-b2b-conforme-rgpd-emails-generiques',
    title:
      'Prospection B2B internationale : pourquoi privilégier les adresses génériques qualifiées et domaines MX vérifiés',
    meta_title: 'Annuaire B2B & Conformité : Emails Génériques et Validation MX (Guide)',
    meta_description:
      'Méthodologie technique pour constituer et nettoyer une base B2B propre : filtrage webmails, adresses fonctionnelles contact@ et vérification DNS MX.',
    reading_time_minutes: 5,
    published_at: '2026-10-30T07:00:00.000Z',
    outline: [
      '1. Coordonnées de personnes morales : le socle sain en B2B',
      '2. Le pipeline de contrôle qualité en 4 filtres',
      '3. Validation DNS/MX avant mise en base',
    ],
    content_html: `<p>Cibler exclusivement les adresses génériques d'entreprise (contact@, info@, hello@) évite l'intrusion dans la sphère personnelle et maximise la pérennité de la donnée.</p>`,
    faq_items: [],
  },
];
