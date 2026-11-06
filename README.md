# Valence Studio — Boutique Internationale de Produits Numériques & Agent d'Acquisition IA

Infrastructure e-commerce autonome prête pour la production, conçue pour vendre à l'international des **templates**, **guides**, **packs de prompts IA** et **annuaires de contacts B2B**, adossée à un **agent d'acquisition éditorial quotidien**.

---

## Architecture Technique

```text
valence-studio/
├── frontend/                  # GitHub Pages (HTML5 + Tailwind CDN + GSAP/ScrollTrigger CDN)
│   ├── index.html             # Accueil (Hero animé, compteurs, produits 3D tilt, lead magnet)
│   ├── catalogue.html         # Catalogue filtrable + recherche + devises EUR/USD + FR/EN
│   ├── produit.html           # Page produit (aperçu interactif, FAQ, garanties, CTA)
│   ├── checkout.html          # Checkout international (Saspay + Stripe en option)
│   ├── merci.html             # Confirmation & téléchargement signé (24h, 3 max)
│   ├── ressource-gratuite.html# Lead magnet avec consentement explicite & double opt-in
│   ├── mentions-legales.html  # Mentions légales, CGV internationales, RGPD & désinscription
│   ├── blog.html              # Journal SEO & lecteur d'articles (Schema.org JSON-LD)
│   ├── admin.html             # Tableau de stats, digest IA & importateur CSV Annuaire B2B
│   ├── articles/              # Pages HTML SEO statiques générées pour GitHub Pages
│   └── sitemap.xml            # Sitemap XML SEO
├── package.json               # Dépendances & scripts Node.js à la racine pour déploiement direct Render
├── index.js                   # Point d'entrée racine Express (compatible npm start / node index.js)
├── src/                       # Backend Node.js 20+ (Express) — Render Free (1 instance, sans état)
│   ├── payments/              # Interface abstraite PaymentProvider + SaspayProvider + StripeProvider
│   ├── acquisition/           # Lead magnet, nurturing Groq J+1/J+3/J+5, digest quotidien, PublishAdapter
│   ├── services/              # Supabase Storage privé, Brevo, Groq, QStash, B2B CSV, SEO
│   ├── middleware/            # Helmet, CORS strict, Rate limiting, Auth Admin & Signature QStash
│   └── routes/                # /health, /api/products, /api/checkout, /api/webhooks, /api/leads...
├── scripts/
│   ├── setup-qstash.js        # Création automatique des crons Upstash QStash (*/5 /health + 0 7 * * *)
│   ├── import-b2b-csv.js      # CLI d'import et nettoyage qualité d'annuaire B2B (.csv)
│   ├── build-seo-pages.js     # Synchronisation des pages SEO statiques & sitemap.xml
│   └── smoke-test.js          # Suite de tests d'intégration bout-en-bout
├── supabase/
│   ├── schema.sql             # Tables PostgreSQL, index, RLS et fonction atomique consume_download_slot
│   └── seed.sql               # Catalogue initial (6 actifs) + articles SEO initiaux
├── .github/workflows/
│   └── deploy-pages.yml       # Déploiement continu vers GitHub Pages
├── render.yaml                # Blueprint Render Free (instance unique)
└── .env.example               # Toutes les variables d'environnement documentées
```

---

## Guide Pas-à-Pas pour Brancher Vos Clés API

### Étape 1 — Base de Données & Stockage Privé Supabase

1. Créez un projet gratuit sur [Supabase](https://supabase.com).
2. Ouvrez **SQL Editor &rarr; New Query**, collez l'intégralité de `supabase/schema.sql`, puis exécutez-le.
3. Exécutez ensuite `supabase/seed.sql` pour insérer le catalogue de départ (ou ajoutez vos propres produits dans la table `public.products`).
4. Allez dans **Storage &rarr; New Bucket** :
   - Nom du bucket : `digital-products`
   - Décochez **Public bucket** (**le bucket doit impérativement rester PRIVÉ**).
   - Uploadez vos archives `.zip` aux chemins correspondants à la colonne `storage_path` de vos produits (ex. `products/notion-agency-os-v3.zip` et `free/valence-starter-kit.zip`).
5. Récupérez dans **Project Settings &rarr; API** :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` *(clé `service_role` secrète, uniquement côté Render/Backend)*.

---

### Étape 2 — Emails Transactionnels & Digest via Brevo

1. Créez un compte sur [Brevo](https://www.brevo.com).
2. Vérifiez votre domaine expéditeur (SPF / DKIM) et votre adresse d'envoi dans **Senders, Domains & Dedicated IPs**.
3. Créez une clé API v3 dans **SMTP & API &rarr; API Keys** :
   - `BREVO_API_KEY=xkeysib-...`
   - `EMAIL_FROM_ADDRESS=bonjour@votredomaine.com`
   - `EMAIL_FROM_NAME=Valence Studio`
   - `OWNER_DIGEST_EMAIL=votre-email-personnel@votredomaine.com` *(adresse qui recevra chaque matin les idées de posts, l'article SEO et les scripts TikTok/Reels)*.

---

### Étape 3 — Intelligence Artificielle Groq (`llama-3.3-70b-versatile`)

1. Ouvrez [Groq Console](https://console.groq.com/keys) et générez une clé API.
2. Renseignez :
   - `GROQ_API_KEY=gsk_...`
   - `GROQ_MODEL=llama-3.3-70b-versatile`
   - `ACQUISITION_NICHE=...` *(ajustez si besoin la description éditoriale de votre audience cible)*.

---

### Étape 4 — Passerelle de Paiement Saspay (& Stripe en Option)

L'architecture repose sur `backend/src/payments/PaymentProvider.js` :

#### A. Brancher Saspay (`backend/src/payments/SaspayProvider.js`)
1. Renseignez vos accès marchand Saspay :
   - `DEFAULT_PAYMENT_PROVIDER=saspay`
   - `SASPAY_API_BASE_URL=https://api.saspay.com` *(adaptez l'hôte exact fourni par votre documentation Saspay)*
   - `SASPAY_CHECKOUT_PATH=/v1/checkout/sessions`
   - `SASPAY_MERCHANT_ID=merch_...`
   - `SASPAY_API_KEY=saspay_live_...`
   - `SASPAY_WEBHOOK_SECRET=whsec_...`
   - `SASPAY_SIGNATURE_HEADER=x-saspay-signature`
2. Dans le dashboard Saspay, configurez l'URL de Webhook vers :
   `https://<votre-service>.onrender.com/api/webhooks/saspay`
   *(La route vérifie la signature HMAC-SHA256 directement sur le `Buffer` brut et garantit l'idempotence via `public.webhook_events`)*.

#### B. Activer Stripe en option (`backend/src/payments/StripeProvider.js`)
1. Renseignez `STRIPE_SECRET_KEY=sk_live_...` et `STRIPE_WEBHOOK_SECRET=whsec_...`.
2. Pointez le webhook Stripe (`checkout.session.completed`) vers :
   `https://<votre-service>.onrender.com/api/webhooks/stripe`

> **Important en production :** vérifiez que `PAYMENT_SANDBOX_MODE=false` est bien défini sur Render.

---

### Étape 5 — Déploiement du Backend sur Render Free (1 Instance)

1. Poussez ce dépôt sur GitHub (vérifiez que `.env` n'est jamais commité grâce à `.gitignore`).
2. Sur [Render](https://render.com), cliquez sur **New &rarr; Blueprint** (qui lira `render.yaml`) ou **New &rarr; Web Service** :
   - **Root Directory** : `backend`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : `Free` (1 seule instance)
3. Copiez toutes les variables de `.env.example` dans l'onglet **Environment** de Render :
   - Générez `ADMIN_API_KEY` et `APP_HMAC_SECRET` avec :
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Définissez `BACKEND_PUBLIC_URL=https://votre-api.onrender.com`
   - Définissez `FRONTEND_PUBLIC_URL=https://emstronglezin-cmd.github.io/valence-studio`
   - Définissez `ALLOWED_ORIGINS=https://emstronglezin-cmd.github.io` *(CORS strict limité au domaine du front)*.

---

### Étape 6 — Planification Sans État & Keepalive avec Upstash QStash

Aucun `setInterval` ni timer en mémoire n'est utilisé côté Node.js. Toute la planification (nurturing J+1/J+3/J+5, génération quotidienne et keepalive Render) passe par **Upstash QStash** :

1. Créez un projet QStash sur [Upstash Console](https://console.upstash.com/qstash).
2. Copiez dans vos variables Render (et votre `backend/.env` local le temps du setup) :
   - `QSTASH_URL=https://qstash.upstash.io`
   - `QSTASH_TOKEN=...`
   - `QSTASH_CURRENT_SIGNING_KEY=sig_...`
   - `QSTASH_NEXT_SIGNING_KEY=sig_...`
3. Lancez une seule fois la commande d'enregistrement automatique des deux crons :
   ```bash
   cd backend
   npm run qstash:setup
   ```
   Cela enregistre sur Upstash :
   - **`valence-keepalive-health`** : `*/5 * * * *` &rarr; `GET https://votre-api.onrender.com/health` *(empêche la mise en veille de l'instance Render Free)*
   - **`valence-daily-acquisition`** : `0 7 * * *` &rarr; `POST https://votre-api.onrender.com/api/jobs/daily-content` *(génère 3 idées de posts + 1 article SEO + 3 scripts TikTok/Reels et vous envoie le digest du matin par email, sans aucune publication automatique)*.

---

### Étape 7 — Déploiement du Front-End sur GitHub Pages

1. Ouvrez `frontend/assets/js/config.js` et remplacez l'URL Render dans :
   ```js
   apiBaseUrl: isGitHubPages ? 'https://votre-api.onrender.com' : '',
   ```
2. Dans votre dépôt GitHub : **Settings &rarr; Pages &rarr; Build and deployment &rarr; Source : GitHub Actions**.
3. Optionnel (pour pré-générer aussi les fichiers statiques SEO à chaque push) : ajoutez dans **Settings &rarr; Secrets and variables &rarr; Actions &rarr; Variables** :
   - `BACKEND_PUBLIC_URL`
   - `FRONTEND_PUBLIC_URL`
4. À chaque `git push origin main`, le workflow `.github/workflows/deploy-pages.yml` publie automatiquement `frontend/` sur GitHub Pages.

---

### Étape 8 — Importer Votre Annuaire B2B (CSV)

Vous disposez de deux méthodes pour importer et filtrer votre fichier CSV (`company_name,email,sector,country,city,website`) :

1. **En ligne de commande** :
   ```bash
   cd backend
   npm run import:b2b -- /chemin/vers/vos-contacts.csv
   ```
2. **Depuis l'interface graphique sécurisée** :
   Ouvrez `admin.html`, authentifiez-vous avec votre `ADMIN_API_KEY`, chargez votre `.csv` puis cliquez sur **Exporter la base propre (.csv)**.

**Règles automatiques appliquées à chaque ligne :**
- Validation syntaxique RFC de l'adresse email et du domaine ;
- Dédoublonnage insensible à la casse (intra-CSV et vis-à-vis de Supabase) ;
- Exclusion stricte des webmails personnels et jetables (`gmail.com`, `yahoo.com`, `outlook.com`, `orange.fr`, `yopmail.com`...) ;
- Conservation exclusive des adresses génériques de personnes morales (`contact@`, `info@`, `bonjour@`, `hello@`, `sales@`, `commercial@`, `support@`, `direction@`...) et rejet de toute adresse nominative (`prenom.nom@...`) ;
- Vérification DNS réelle des serveurs de messagerie (`MX` / `A`) du domaine.

---

## Développement & Tests en Local

```bash
cd backend
cp ../.env.example .env
npm install

# Lancer la suite complète de tests d'intégration (8 scénarios bout-en-bout)
npm run test:smoke

# Démarrer le serveur local (API + aperçu du front sur http://localhost:3000)
npm run dev
```

---

## Brancher TikTok Plus Tard (`PublishAdapter`)

Par conception, aucune publication automatique n'a lieu aujourd'hui (`NoopPublishAdapter` retourne `published: false`). Lorsque vous souhaiterez activer la publication vers l'API TikTok Content Posting v2 :
1. Complétez `TikTokPublishAdapter` dans `backend/src/acquisition/PublishAdapter.js` ;
2. Passez `isEnabled()` à `true` lorsque `TIKTOK_ACCESS_TOKEN` est défini ;
3. Injectez cette instance dans `contentGeneratorService.runDailyAcquisitionCycle()`.
