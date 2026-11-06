import { Router } from 'express';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';

export const healthRouter = Router();

/**
 * Endpoint de santé et de keepalive (appelé toutes les 5 minutes `*\5 * * * *` par Upstash QStash
 * afin de maintenir l'instance unique Render Free active sans timer en mémoire).
 */
healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'valence-studio-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    integrations: {
      supabase: repository.isDatabaseConnected() ? 'connected' : 'local_fallback',
      saspay: env.payments.saspay.isConfigured ? 'configured' : 'ready_to_connect',
      stripe: env.payments.stripe.isConfigured ? 'configured' : 'optional_unconfigured',
      brevo: env.brevo.isConfigured ? 'configured' : 'ready_to_connect',
      groq: env.groq.isConfigured ? 'configured' : 'ready_to_connect',
      qstash: env.qstash.isConfigured ? 'configured' : 'ready_to_connect',
    },
  });
});
