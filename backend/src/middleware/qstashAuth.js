import { Receiver } from '@upstash/qstash';
import { env } from '../config/env.js';
import { isValidAdminToken } from './adminAuth.js';

export async function requireQStashOrAdmin(req, res, next) {
  // 1. Autoriser un déclenchement manuel authentifié par l'administrateur
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ') && isValidAdminToken(authHeader.slice(7).trim())) {
    return next();
  }

  // 2. Vérifier la signature cryptographique Upstash QStash sur le body brut
  const signature = req.headers['upstash-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(401).json({
      error: 'Signature Upstash-Signature manquante.',
    });
  }

  if (!env.qstash.currentSigningKey) {
    return res.status(503).json({
      error: 'Clés de signature QStash non configurées côté serveur.',
    });
  }

  try {
    const receiver = new Receiver({
      currentSigningKey: env.qstash.currentSigningKey,
      nextSigningKey: env.qstash.nextSigningKey || env.qstash.currentSigningKey,
    });

    const rawBodyString = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.rawBody === 'string'
        ? req.rawBody
        : JSON.stringify(req.body || {});

    const destinationUrl = `${env.backendPublicUrl}${req.originalUrl}`;
    const isValid = await receiver.verify({
      signature,
      body: rawBodyString,
      url: destinationUrl,
    });

    if (!isValid) {
      return res.status(403).json({ error: 'Signature QStash invalide.' });
    }

    return next();
  } catch (err) {
    return res.status(403).json({
      error: 'Échec de vérification cryptographique QStash.',
      detail: env.isProduction ? undefined : err.message,
    });
  }
}
