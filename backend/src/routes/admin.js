import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { adminLimiter } from '../middleware/security.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { validateBody } from '../middleware/validate.js';
import { b2bDirectoryService } from '../services/b2bDirectoryService.js';
import { contentGeneratorService } from '../acquisition/contentGeneratorService.js';
import { qstashService } from '../services/qstashService.js';
import { emailService } from '../services/emailService.js';

export const adminRouter = Router();

adminRouter.use(adminLimiter);
adminRouter.use(requireAdminAuth);

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const stats = await repository.getDashboardStats();
    return res.json({
      stats,
      integrations: {
        supabase: repository.isDatabaseConnected(),
        saspay: env.payments.saspay.isConfigured,
        stripe: env.payments.stripe.isConfigured,
        brevo: env.brevo.isConfigured,
        groq: env.groq.isConfigured,
        qstash: env.qstash.isConfigured,
      },
      recentSimulatedEmails: env.isProduction ? [] : emailService.getRecentOutbox(),
    });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get('/contents', async (_req, res, next) => {
  try {
    const contents = await repository.listDailyContents({ limit: 15 });
    return res.json({ contents });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/jobs/trigger-daily', async (_req, res, next) => {
  try {
    const summary = await contentGeneratorService.runDailyAcquisitionCycle();
    return res.json({ ok: true, summary });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/qstash/setup', async (_req, res, next) => {
  try {
    const schedules = await qstashService.setupProductionSchedules();
    return res.json({ ok: true, schedules });
  } catch (err) {
    return next(err);
  }
});

const importB2BSchema = z.object({
  csvContent: z.string().min(10, 'Contenu CSV trop court.').max(5_000_000, 'CSV limité à 5 Mo par lot.'),
  sourceBatch: z.string().max(80).optional(),
  verifyDns: z.boolean().optional(),
});

adminRouter.post('/b2b/import', validateBody(importB2BSchema), async (req, res, next) => {
  try {
    const report = await b2bDirectoryService.importFromCsvString(req.validatedBody.csvContent, {
      sourceBatch: req.validatedBody.sourceBatch || `admin_${new Date().toISOString().slice(0, 10)}`,
      verifyDns: req.validatedBody.verifyDns ?? env.b2b.verifyDnsMx,
    });
    return res.status(200).json({ ok: true, report });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get('/b2b/contacts', async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '100'), 10)));
    const contacts = await repository.listB2BContacts({ limit });
    return res.json({ contacts });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get('/b2b/export', async (_req, res, next) => {
  try {
    const contacts = await repository.listB2BContacts({ limit: 10000 });
    const csv = b2bDirectoryService.exportToCsv(contacts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="annuaire-b2b-verifie-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
});
