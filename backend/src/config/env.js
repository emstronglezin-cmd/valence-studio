import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge backend/.env puis ../.env si disponible
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const parseAllowedOrigins = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

// En développement uniquement, un secret HMAC éphémère de session est généré si absent
// En production sur Render, APP_HMAC_SECRET est généré/fourni dans les variables d'environnement
const fallbackDevSecret = crypto
  .createHash('sha256')
  .update(`valence-dev-hmac-${process.cwd()}`)
  .digest('hex');

export const env = {
  nodeEnv,
  isProduction,
  port,

  backendPublicUrl: (process.env.BACKEND_PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  frontendPublicUrl: (process.env.FRONTEND_PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  hasExplicitBackendUrl: Boolean(process.env.BACKEND_PUBLIC_URL),
  hasExplicitFrontendUrl: Boolean(process.env.FRONTEND_PUBLIC_URL),
  browserApiPrefix: process.env.BACKEND_PUBLIC_URL
    ? process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')
    : '',
  browserFrontendPrefix: process.env.FRONTEND_PUBLIC_URL
    ? process.env.FRONTEND_PUBLIC_URL.replace(/\/+$/, '')
    : '',
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  serveFrontendStatic:
    process.env.SERVE_FRONTEND_STATIC === 'true' || (!isProduction && process.env.SERVE_FRONTEND_STATIC !== 'false'),

  adminApiKey: process.env.ADMIN_API_KEY || '',
  appHmacSecret: process.env.APP_HMAC_SECRET || (isProduction ? '' : fallbackDevSecret),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'digital-products',
    leadMagnetStoragePath: process.env.LEAD_MAGNET_STORAGE_PATH || 'free/valence-starter-kit.zip',
    isConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  delivery: {
    ttlHours: Math.max(1, Number.parseInt(process.env.DOWNLOAD_LINK_TTL_HOURS || '24', 10)),
    maxDownloads: Math.max(1, Number.parseInt(process.env.DOWNLOAD_MAX_COUNT || '3', 10)),
  },

  payments: {
    defaultProvider: (process.env.DEFAULT_PAYMENT_PROVIDER || 'saspay').toLowerCase(),
    sandboxMode: !isProduction && process.env.PAYMENT_SANDBOX_MODE !== 'false',
    saspay: {
      apiBaseUrl: (process.env.SASPAY_API_BASE_URL || 'https://api.saspay.com').replace(/\/+$/, ''),
      checkoutPath: process.env.SASPAY_CHECKOUT_PATH || '/v1/checkout/sessions',
      merchantId: process.env.SASPAY_MERCHANT_ID || '',
      apiKey: process.env.SASPAY_API_KEY || '',
      webhookSecret: process.env.SASPAY_WEBHOOK_SECRET || '',
      signatureHeader: (process.env.SASPAY_SIGNATURE_HEADER || 'x-saspay-signature').toLowerCase(),
      isConfigured: Boolean(
        process.env.SASPAY_API_KEY &&
          process.env.SASPAY_MERCHANT_ID &&
          process.env.SASPAY_WEBHOOK_SECRET
      ),
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      isConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
  },

  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'bonjour@valence-studio.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Valence Studio',
    ownerDigestEmail: process.env.OWNER_DIGEST_EMAIL || '',
    isConfigured: Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS),
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    niche:
      process.env.ACQUISITION_NICHE ||
      'Produits numériques B2B, templates Notion & Design, systèmes de prompts IA, prospection internationale et automatisation pour freelances, studios et PME',
    isConfigured: Boolean(process.env.GROQ_API_KEY),
  },

  qstash: {
    url: (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/+$/, ''),
    token: process.env.QSTASH_TOKEN || '',
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
    dailyContentCron: process.env.DAILY_CONTENT_CRON || '0 7 * * *',
    isConfigured: Boolean(
      process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY
    ),
  },

  b2b: {
    verifyDnsMx: process.env.B2B_VERIFY_DNS_MX !== 'false',
  },
};
