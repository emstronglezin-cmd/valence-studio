import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { analyticsLimiter } from '../middleware/security.js';
import { validateBody } from '../middleware/validate.js';

export const analyticsRouter = Router();

const visitSchema = z.object({
  path: z.string().min(1).max(200),
  referrer: z.string().max(400).optional().nullable(),
});

analyticsRouter.post(
  '/visit',
  analyticsLimiter,
  validateBody(visitSchema),
  async (req, res, next) => {
    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      const userAgent = String(req.headers['user-agent'] || 'unknown');
      const clientIp = String(req.ip || '0.0.0.0');

      // Empreinte journalière salée et irréversible (respectueuse de la vie privée, zéro cookie)
      const visitorHash = crypto
        .createHmac('sha256', env.appHmacSecret)
        .update(`${dayKey}:${clientIp}:${userAgent}`)
        .digest('hex')
        .slice(0, 32);

      await repository.recordPageVisit({
        path: req.validatedBody.path,
        visitorHash,
        referrer: req.validatedBody.referrer || null,
        countryHint: String(req.headers['cf-ipcountry'] || '').slice(0, 8) || null,
      });

      return res.status(202).json({ recorded: true });
    } catch (err) {
      return next(err);
    }
  }
);
