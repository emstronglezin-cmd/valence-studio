import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './config/env.js';
import {
  securityHeaders,
  strictCors,
  globalApiLimiter,
} from './middleware/security.js';
import { healthRouter } from './routes/health.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { webhooksRouter } from './routes/webhooks.js';
import { downloadsRouter } from './routes/downloads.js';
import { leadsRouter } from './routes/leads.js';
import { jobsRouter } from './routes/jobs.js';
import { seoApiRouter, seoPublicRouter } from './routes/seo.js';
import { analyticsRouter } from './routes/analytics.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Indispensable derrière le reverse-proxy Render pour rate-limiting par IP réelle
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(strictCors);

  // 1. Keepalive Render Free (cron QStash */5)
  app.use(healthRouter);

  // 2. Webhooks de paiement montés AVANT express.json() pour préserver le Buffer brut exact
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '512kb' }), webhooksRouter);

  // 3. Parseur JSON avec conservation de rawBody pour la vérification Upstash-Signature
  app.use(
    express.json({
      limit: '6mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // 4. Limitation globale de débit sur /api
  app.use('/api', globalApiLimiter);

  // 5. Routes métier & Agent d'acquisition
  app.use('/api/products', productsRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/downloads', downloadsRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/seo', seoApiRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/admin', adminRouter);

  // 6. Pages SEO SSR, sitemap.xml et robots.txt
  app.use(seoPublicRouter);

  // 7. En développement / aperçu local uniquement : servir le dossier statique frontend/
  if (env.serveFrontendStatic) {
    const frontendDir = path.resolve(__dirname, '../../frontend');
    app.use(express.static(frontendDir, { extensions: ['html'] }));
  }

  // 8. Gestionnaire 404 API
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API introuvable.' });
  });

  // 9. Gestionnaire global d'erreurs (aucune fuite de stacktrace en production)
  app.use((err, _req, res, _next) => {
    if (err?.message?.includes('CORS')) {
      return res.status(403).json({ error: err.message });
    }
    console.error('[BackendError]', err);
    return res.status(err.status || 500).json({
      error: env.isProduction
        ? 'Une erreur interne est survenue. Veuillez réessayer.'
        : err.message || 'Erreur serveur.',
    });
  });

  return app;
}
