import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { getPaymentProvider, listAvailablePaymentProviders } from '../payments/index.js';
import { strictActionLimiter } from '../middleware/security.js';
import { validateBody } from '../middleware/validate.js';
import {
  signDownloadToken,
  verifyDownloadSignature,
} from '../services/storageService.js';
import { handleRawPaymentWebhook } from './webhooks.js';

export const checkoutRouter = Router();

const createSessionSchema = z.object({
  productSlug: z.string().min(2).max(120),
  customerEmail: z.string().email().max(254),
  customerName: z.string().min(1).max(120).optional(),
  companyName: z.string().max(140).optional(),
  countryCode: z.string().min(2).max(3).default('FR'),
  currency: z.enum(['EUR', 'USD']).default('EUR'),
  provider: z.enum(['saspay', 'stripe']).default('saspay'),
  waiverAccepted: z.literal(true, {
    errorMap: () => ({
      message:
        'Vous devez accepter les CGV et la fourniture immédiate du contenu numérique avant paiement.',
    }),
  }),
});

function buildOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VLC-${datePart}-${randPart}`;
}

checkoutRouter.get('/providers', (_req, res) => {
  res.json({
    defaultProvider: env.payments.defaultProvider,
    providers: listAvailablePaymentProviders(),
  });
});

checkoutRouter.post(
  '/session',
  strictActionLimiter,
  validateBody(createSessionSchema),
  async (req, res, next) => {
    try {
      const input = req.validatedBody;
      const product = await repository.getProductBySlug(input.productSlug);
      if (!product) {
        return res.status(404).json({ error: 'Produit introuvable ou indisponible.' });
      }

      const amountCents =
        input.currency === 'USD' ? product.price_cents_usd : product.price_cents_eur;
      const provider = getPaymentProvider(input.provider);

      const order = await repository.createOrder({
        orderNumber: buildOrderNumber(),
        productId: product.id,
        productSlug: product.slug,
        productTitle: product.title_fr,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        companyName: input.companyName,
        countryCode: input.countryCode.toUpperCase(),
        currency: input.currency,
        amountCents,
        provider: provider.getName(),
        waiverAccepted: input.waiverAccepted,
      });

      const successUrl = `${env.frontendPublicUrl}/merci.html?order_id=${encodeURIComponent(order.id)}`;
      const cancelUrl = `${env.frontendPublicUrl}/checkout.html?slug=${encodeURIComponent(product.slug)}&canceled=1`;
      const webhookUrl = `${env.backendPublicUrl}/api/webhooks/${provider.getName()}`;

      const session = await provider.createCheckoutSession({
        order,
        product,
        successUrl,
        cancelUrl,
        webhookUrl,
      });

      await repository.updateOrderSession(order.id, session.sessionId);

      return res.status(201).json({
        orderId: order.id,
        orderNumber: order.order_number,
        provider: provider.getName(),
        checkoutUrl: session.checkoutUrl,
        sandbox: Boolean(session.sandbox),
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Route de simulation de paiement (active UNIQUEMENT hors production lorsque PAYMENT_SANDBOX_MODE=true).
 * Elle génère un body brut signé et appelle le pipeline exact de webhook afin de valider toute la chaîne.
 */
checkoutRouter.get('/sandbox-complete', async (req, res, next) => {
  try {
    if (!env.payments.sandboxMode || env.isProduction) {
      return res.status(403).json({ error: 'Mode bac à sable désactivé en production.' });
    }

    const providerName = String(req.query.provider || 'saspay').toLowerCase();
    const orderId = String(req.query.order_id || '');
    const sessionId = String(req.query.session_id || '');
    const sig = String(req.query.sig || '');

    const expectedSig = crypto
      .createHmac('sha256', env.appHmacSecret)
      .update(`${orderId}:${sessionId}`)
      .digest('hex');

    if (!sig || sig !== expectedSig) {
      return res.status(403).json({ error: 'Signature de session sandbox invalide.' });
    }

    let rawBodyBuffer;
    let headers = {};

    if (providerName === 'stripe') {
      const payload = {
        id: `evt_sbx_${sessionId}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            payment_intent: `pi_sbx_${orderId.slice(0, 8)}`,
            client_reference_id: orderId,
            metadata: { order_id: orderId },
          },
        },
      };
      rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
      headers['stripe-signature'] = crypto
        .createHmac('sha256', env.appHmacSecret)
        .update(rawBodyBuffer)
        .digest('hex');
    } else {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        id: `evt_saspay_${sessionId}`,
        event: 'payment.succeeded',
        data: {
          id: sessionId,
          session_id: sessionId,
          payment_id: `pay_saspay_${orderId.slice(0, 8)}`,
          order_id: orderId,
          metadata: { order_id: orderId },
        },
      };
      rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
      const secret = env.payments.saspay.webhookSecret || env.appHmacSecret;
      const v1 = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.`, 'utf8')
        .update(rawBodyBuffer)
        .digest('hex');
      headers[env.payments.saspay.signatureHeader] = `t=${timestamp},v1=${v1}`;
    }

    const outcome = await handleRawPaymentWebhook(providerName, rawBodyBuffer, headers);
    if (outcome.body?.thankYouUrl) {
      return res.redirect(302, outcome.body.thankYouUrl);
    }

    return res.redirect(
      302,
      `${env.browserFrontendPrefix}/merci.html?order_id=${encodeURIComponent(orderId)}`
    );
  } catch (err) {
    return next(err);
  }
});

checkoutRouter.get('/order-status', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    const sig = String(req.query.sig || '').trim();
    const orderId = String(req.query.order_id || '').trim();
    const apiPrefix = env.browserApiPrefix;

    if (token && sig) {
      if (!verifyDownloadSignature(token, sig)) {
        return res.status(403).json({ error: 'Signature du jeton invalide.' });
      }
      const tokenInfo = await repository.getDownloadTokenInfo(token);
      if (!tokenInfo) {
        return res.status(404).json({ error: 'Jeton de téléchargement introuvable.' });
      }
      return res.json({
        status: 'paid',
        order: tokenInfo.orders || null,
        delivery: {
          token: tokenInfo.token,
          fileName: tokenInfo.file_name,
          expiresAt: tokenInfo.expires_at,
          maxDownloads: tokenInfo.max_downloads,
          downloadCount: tokenInfo.download_count,
          remainingDownloads: Math.max(0, tokenInfo.max_downloads - tokenInfo.download_count),
          signedDownloadUrl: `${apiPrefix}/api/downloads/${tokenInfo.token}?sig=${sig}`,
        },
      });
    }

    if (orderId) {
      const order = await repository.getOrderByIdOrSession({ orderId });
      if (!order) {
        return res.status(404).json({ error: 'Commande introuvable.' });
      }
      if (order.status !== 'paid') {
        return res.json({
          status: order.status,
          order: {
            order_number: order.order_number,
            product_title: order.product_title,
            amount_cents: order.amount_cents,
            currency: order.currency,
          },
          delivery: null,
        });
      }

      const tokenEntry = await repository.getDownloadTokenByOrderId(order.id);
      if (!tokenEntry) {
        return res.json({ status: 'paid', order, delivery: null });
      }

      const tokenSig = signDownloadToken(tokenEntry.token);
      return res.json({
        status: 'paid',
        order: {
          order_number: order.order_number,
          product_title: order.product_title,
          product_slug: order.product_slug,
          customer_email: order.customer_email,
          amount_cents: order.amount_cents,
          currency: order.currency,
          paid_at: order.paid_at,
        },
        delivery: {
          token: tokenEntry.token,
          fileName: tokenEntry.file_name,
          expiresAt: tokenEntry.expires_at,
          maxDownloads: tokenEntry.max_downloads,
          downloadCount: tokenEntry.download_count,
          remainingDownloads: Math.max(0, tokenEntry.max_downloads - tokenEntry.download_count),
          signedDownloadUrl: `${apiPrefix}/api/downloads/${tokenEntry.token}?sig=${tokenSig}`,
        },
      });
    }

    return res.status(400).json({ error: 'Paramètre token ou order_id requis.' });
  } catch (err) {
    return next(err);
  }
});
