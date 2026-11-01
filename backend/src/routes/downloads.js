import { Router } from 'express';
import { authorizeAndResolvePrivateFile } from '../services/storageService.js';

export const downloadsRouter = Router();

/**
 * Téléchargement sécurisé :
 * - Vérifie la signature HMAC du lien
 * - Vérifie l'expiration (24h) et consomme atomiquement 1 crédit (max 3 téléchargements)
 * - Redirige vers une URL signée éphémère (60s) générée sur le bucket privé Supabase Storage
 */
downloadsRouter.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    const sig = String(req.query.sig || '').trim();

    const result = await authorizeAndResolvePrivateFile(token, sig);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.mode === 'redirect') {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, result.signedStorageUrl);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.status(200).send(result.buffer);
  } catch (err) {
    return next(err);
  }
});
