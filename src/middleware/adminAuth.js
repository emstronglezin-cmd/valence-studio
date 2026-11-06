import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function isValidAdminToken(candidateToken) {
  if (!env.adminApiKey || !candidateToken || typeof candidateToken !== 'string') {
    return false;
  }
  const expectedDigest = crypto.createHash('sha256').update(env.adminApiKey).digest();
  const actualDigest = crypto.createHash('sha256').update(candidateToken).digest();
  return crypto.timingSafeEqual(expectedDigest, actualDigest);
}

export function requireAdminAuth(req, res, next) {
  if (!env.adminApiKey) {
    return res.status(503).json({
      error: 'Protection admin active : veuillez définir ADMIN_API_KEY dans les variables serveur.',
    });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentification requise (en-tête Authorization: Bearer <ADMIN_API_KEY>).',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!isValidAdminToken(token)) {
    return res.status(403).json({
      error: 'Clé administrateur invalide.',
    });
  }

  return next();
}
