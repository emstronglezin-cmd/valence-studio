-- ==============================================================================
-- VALENCE STUDIO — SCHÉMA POSTGRESQL COMPLET POUR SUPABASE
-- ==============================================================================
-- Exécutez ce script dans l'éditeur SQL de Supabase (SQL Editor -> New Query)
-- suivi de `supabase/seed.sql` pour insérer le catalogue initial.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CATALOGUE DE PRODUITS NUMÉRIQUES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('templates', 'guides', 'prompts', 'directory')),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  subtitle_fr TEXT NOT NULL,
  subtitle_en TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_en TEXT NOT NULL,
  price_cents_eur INTEGER NOT NULL CHECK (price_cents_eur >= 0),
  price_cents_usd INTEGER NOT NULL CHECK (price_cents_usd >= 0),
  storage_path TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_size_label TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  featured BOOLEAN NOT NULL DEFAULT false,
  badge_fr TEXT,
  badge_en TEXT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- ------------------------------------------------------------------------------
-- 2. COMMANDES & PAIEMENTS (SASPAY / STRIPE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL,
  product_title TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  company_name TEXT,
  country_code TEXT DEFAULT 'FR',
  currency TEXT NOT NULL CHECK (currency IN ('EUR', 'USD')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  provider TEXT NOT NULL CHECK (provider IN ('saspay', 'stripe')),
  provider_session_id TEXT,
  provider_payment_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  waiver_accepted BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(lower(customer_email));
CREATE INDEX IF NOT EXISTS idx_orders_provider_session ON public.orders(provider, provider_session_id);

-- ------------------------------------------------------------------------------
-- 3. IDEMPOTENCE DES WEBHOOKS DE PAIEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

-- ------------------------------------------------------------------------------
-- 4. JETONS DE TÉLÉCHARGEMENT SIGNÉS (EXPIRATION 24H, MAX 3 TÉLÉCHARGEMENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  max_downloads INTEGER NOT NULL DEFAULT 3 CHECK (max_downloads > 0),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON public.download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_order ON public.download_tokens(order_id);

-- Fonction atomique garantissant qu'aucun dépassement de quota (max 3) ne survient
-- même en cas de requêtes parallèles simultanées.
CREATE OR REPLACE FUNCTION public.consume_download_slot(p_token TEXT)
RETURNS SETOF public.download_tokens
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.download_tokens
  SET
    download_count = download_count + 1,
    last_downloaded_at = NOW()
  WHERE token = p_token
    AND expires_at > NOW()
    AND download_count < max_downloads
  RETURNING *;
$$;

-- ------------------------------------------------------------------------------
-- 5. LEADS (LEAD MAGNET, DOUBLE OPT-IN & DÉSINSCRIPTION RGPD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  locale TEXT NOT NULL DEFAULT 'fr',
  source TEXT NOT NULL DEFAULT 'lead_magnet',
  consent_given BOOLEAN NOT NULL DEFAULT true,
  consent_text TEXT NOT NULL,
  consent_ip_hash TEXT,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'unsubscribed')) DEFAULT 'pending',
  confirm_token TEXT UNIQUE,
  confirm_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  unsubscribe_token TEXT UNIQUE NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_confirm_token ON public.leads(confirm_token);
CREATE INDEX IF NOT EXISTS idx_leads_unsubscribe_token ON public.leads(unsubscribe_token);

-- ------------------------------------------------------------------------------
-- 6. SÉQUENCE DE NURTURING IA (J+1, J+3, J+5) VIA GROQ + QSTASH + BREVO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nurturing_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step_day INTEGER NOT NULL CHECK (step_day IN (1, 3, 5)),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  qstash_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sent', 'skipped', 'failed')) DEFAULT 'scheduled',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lead_nurturing_step UNIQUE (lead_id, step_day)
);

CREATE INDEX IF NOT EXISTS idx_nurturing_due ON public.nurturing_emails(status, scheduled_for);

-- ------------------------------------------------------------------------------
-- 7. ARTICLES SEO & CONTENUS QUOTIDIENS D'ACQUISITION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_markdown TEXT NOT NULL,
  content_html TEXT NOT NULL,
  faq_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_time_minutes INTEGER NOT NULL DEFAULT 5,
  published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_articles_published ON public.seo_articles(published_at DESC) WHERE published = true;

CREATE TABLE IF NOT EXISTS public.daily_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_date DATE UNIQUE NOT NULL,
  post_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  short_video_scripts JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_article_id UUID REFERENCES public.seo_articles(id) ON DELETE SET NULL,
  digest_sent_at TIMESTAMPTZ,
  publish_status TEXT NOT NULL DEFAULT 'digest_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. STATISTIQUES DE VISITES (SANS COOKIES INTRUSIFS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  referrer TEXT,
  country_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits(created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. ANNUAIRE B2B VÉRIFIÉ (EMAILS GÉNÉRIQUES PROFESSIONNELS UNIQUEMENT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.b2b_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  role_prefix TEXT NOT NULL,
  sector TEXT,
  country TEXT,
  city TEXT,
  website TEXT,
  mx_verified BOOLEAN NOT NULL DEFAULT false,
  quality_score INTEGER NOT NULL DEFAULT 100,
  source_batch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_contacts_sector_country ON public.b2b_contacts(sector, country);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) — VERROUILLAGE COMPLET PAR DÉFAUT
-- ------------------------------------------------------------------------------
-- Seul le backend Express via SUPABASE_SERVICE_ROLE_KEY accède aux tables.
-- Aucun accès direct non authentifié depuis le navigateur n'est ouvert sur les données privées.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurturing_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_contacts ENABLE ROW LEVEL SECURITY;

-- Lecture publique optionnelle uniquement sur les produits actifs et articles publiés
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" ON public.products
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Public read published seo articles" ON public.seo_articles;
CREATE POLICY "Public read published seo articles" ON public.seo_articles
  FOR SELECT USING (published = true);
