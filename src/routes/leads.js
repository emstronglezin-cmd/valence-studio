import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { strictActionLimiter } from '../middleware/security.js';
import { validateBody } from '../middleware/validate.js';
import { leadMagnetService } from '../acquisition/leadMagnetService.js';

export const leadsRouter = Router();

const subscribeSchema = z.object({
  email: z.string().email('Adresse email invalide.').max(254),
  firstName: z.string().max(80).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  consentGiven: z.literal(true, {
    errorMap: () => ({
      message: 'Veuillez cocher la case de consentement explicite pour recevoir l’extrait gratuit.',
    }),
  }),
  consentText: z
    .string()
    .min(10)
    .max(500)
    .default(
      "J'accepte explicitement de recevoir l'extrait gratuit par email ainsi que la séquence de 3 conseils associés (désinscription en 1 clic à tout moment)."
    ),
});

leadsRouter.post(
  '/subscribe',
  strictActionLimiter,
  validateBody(subscribeSchema),
  async (req, res, next) => {
    try {
      const outcome = await leadMagnetService.requestSubscription({
        ...req.validatedBody,
        ipAddress: req.ip,
      });

      return res.status(200).json({
        ok: true,
        status: outcome.status,
        message:
          outcome.status === 'already_confirmed_resent'
            ? 'Votre adresse est déjà confirmée : un nouveau lien de téléchargement vient de vous être envoyé.'
            : 'Vérifiez votre boîte de réception : cliquez sur le lien de confirmation (double opt-in) pour débloquer votre extrait gratuit.',
        devConfirmUrl: outcome.devConfirmUrl,
      });
    } catch (err) {
      return next(err);
    }
  }
);

leadsRouter.get('/confirm', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).send('Jeton de confirmation manquant.');
    }

    const result = await leadMagnetService.confirmDoubleOptIn(token);
    if (result.status === 'not_found' || result.status === 'expired') {
      return res.redirect(
        302,
        `${env.browserFrontendPrefix}/ressource-gratuite.html?error=${encodeURIComponent(result.status)}`
      );
    }

    const qs = new URLSearchParams({ confirmed: '1' });
    if (result.signedDownloadUrl) {
      qs.set('download', result.signedDownloadUrl);
    }

    return res.redirect(302, `${env.browserFrontendPrefix}/ressource-gratuite.html?${qs.toString()}`);
  } catch (err) {
    return next(err);
  }
});

const handleUnsubscribe = async (req, res, next) => {
  try {
    const token = String(req.query.token || req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Jeton de désinscription manquant.' });
    }

    const updated = await leadMagnetService.unsubscribeByToken(token);
    if (req.method === 'POST') {
      return res.status(200).json({ unsubscribed: Boolean(updated) });
    }

    return res.redirect(
      302,
      `${env.browserFrontendPrefix}/mentions-legales.html?unsubscribed=${updated ? '1' : '0'}#desinscription`
    );
  } catch (err) {
    return next(err);
  }
};

leadsRouter.get('/unsubscribe', handleUnsubscribe);
leadsRouter.post('/unsubscribe', handleUnsubscribe);
