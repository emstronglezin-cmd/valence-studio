import { Router } from 'express';
import { z } from 'zod';
import { requireQStashOrAdmin } from '../middleware/qstashAuth.js';
import { leadMagnetService } from '../acquisition/leadMagnetService.js';
import { contentGeneratorService } from '../acquisition/contentGeneratorService.js';

export const jobsRouter = Router();

jobsRouter.use(requireQStashOrAdmin);

const nurturingJobSchema = z.object({
  nurturingId: z.string().uuid(),
});

jobsRouter.post('/send-nurturing-email', async (req, res, next) => {
  try {
    const parsed = nurturingJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload QStash nurturing invalide.' });
    }

    const result = await leadMagnetService.executeScheduledNurturingEmail(parsed.data.nurturingId);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return next(err);
  }
});

jobsRouter.post('/daily-content', async (req, res, next) => {
  try {
    const customDate =
      typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
        ? req.body.date
        : undefined;

    const summary = await contentGeneratorService.runDailyAcquisitionCycle({
      generationDate: customDate,
    });

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    return next(err);
  }
});
