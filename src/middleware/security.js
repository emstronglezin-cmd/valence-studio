import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://cdnjs.cloudflare.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      frameAncestors: env.isProduction ? ["'none'"] : ["'self'", 'https://*.e2b.app', 'https://*.arena.ai', '*'],
    },
  },
  crossOriginEmbedderPolicy: false,
});

export const strictCors = cors({
  origin(origin, callback) {
    // Requêtes serveur-à-serveur (webhooks, QStash, navigation directe ou curl) sans en-tête Origin
    if (!origin) {
      return callback(null, true);
    }

    const normalized = origin.replace(/\/+$/, '');

    // En production : liste blanche stricte du domaine du front (ex: GitHub Pages)
    if (env.isProduction) {
      if (
        env.allowedOrigins.includes(normalized) ||
        normalized === env.frontendPublicUrl
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origine non autorisée par la politique CORS.'));
    }

    // En développement / aperçu local
    if (
      env.allowedOrigins.length === 0 ||
      env.allowedOrigins.includes(normalized) ||
      normalized.startsWith('http://localhost:') ||
      normalized.startsWith('http://127.0.0.1:') ||
      normalized.endsWith('.e2b.app')
    ) {
      return callback(null, true);
    }

    return callback(new Error('Origine non autorisée par la politique CORS.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Upstash-Signature', 'Stripe-Signature', 'X-Saspay-Signature'],
  credentials: false,
  maxAge: 86400,
});

export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans quelques minutes.' },
});

export const strictActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Limite de sécurité atteinte. Veuillez patienter avant de soumettre à nouveau.' },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives sur les routes d’administration.' },
});

export const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Limite de télémétrie atteinte.' },
});
