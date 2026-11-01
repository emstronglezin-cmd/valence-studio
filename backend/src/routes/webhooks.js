import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import { getPaymentProvider } from '../payments/index.js';
import { repository } from '../db/repository.js';
import { issueSignedProductDelivery } from '../services/storageService.js';
import { emailService } from '../services/emailService.js';

export const webhooksRouter = Router();

/**
 * Traite un webhook de paiement sur le body brut (Buffer) :
 * 1) Vérifie la signature cryptographique du provider (Saspay ou Stripe)
 * 2) Garantit l'idempotence via la table `webhook_events` + statut commande
 * 3) Met à jour la commande en base (`paid`)
 * 4) Crée l'URL signée expirante (24h, max 3 téléchargements) sur Supabase Storage privé
 * 5) Envoie l'email transactionnel de livraison via Brevo
 */
export async function handleRawPaymentWebhook(providerName, rawBodyBuffer, headers) {
  const provider = getPaymentProvider(providerName);
  const parsedEvent = await provider.verifyAndParseWebhook(rawBodyBuffer, headers);

  const payloadHash = crypto.createHash('sha256').update(rawBodyBuffer).digest('hex');
  const { isDuplicate } = await repository.registerWebhookEvent({
    provider: provider.getName(),
    eventId: parsedEvent.eventId,
    eventType: parsedEvent.eventType,
    payloadHash,
  });

  if (isDuplicate) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  if (parsedEvent.eventType !== 'payment.succeeded') {
    return {
      status: 200,
      body: { received: true, ignored: true, eventType: parsedEvent.eventType },
    };
  }

  const order = await repository.getOrderByIdOrSession({
    orderId: parsedEvent.orderId,
    orderNumber: parsedEvent.orderNumber,
    provider: provider.getName(),
    providerSessionId: parsedEvent.providerSessionId,
  });

  if (!order) {
    return {
      status: 404,
      body: { error: 'Commande associée au webhook introuvable.' },
    };
  }

  // Seconde barrière d'idempotence métier : si déjà payée et livrée, ne pas renvoyer d'email
  if (order.status === 'paid' && order.delivered_at) {
    const existingDelivery = await issueSignedProductDelivery({
      orderId: order.id,
      storagePath: `products/${order.product_slug}.zip`,
      fileName: `${order.product_slug}.zip`,
    });
    return {
      status: 200,
      body: {
        received: true,
        alreadyFulfilled: true,
        thankYouUrl: existingDelivery.thankYouUrl,
      },
    };
  }

  const product = await repository.getProductBySlug(order.product_slug);
  const storagePath = product?.storage_path || `products/${order.product_slug}.zip`;
  const fileName = path.basename(storagePath);

  const updatedOrder = await repository.markOrderPaidAndDelivered(order.id, {
    providerPaymentId: parsedEvent.providerPaymentId,
  });

  const delivery = await issueSignedProductDelivery({
    orderId: updatedOrder.id,
    storagePath,
    fileName,
  });

  await emailService.sendOrderDeliveryEmail({
    order: updatedOrder,
    signedDownloadUrl: delivery.signedDownloadUrl,
    thankYouUrl: delivery.thankYouUrl,
    expiresAt: delivery.tokenRecord.expires_at,
    maxDownloads: delivery.tokenRecord.max_downloads,
  });

  return {
    status: 200,
    body: {
      received: true,
      fulfilled: true,
      orderNumber: updatedOrder.order_number,
      thankYouUrl: delivery.thankYouUrl,
    },
  };
}

webhooksRouter.post('/:provider', async (req, res) => {
  try {
    const providerName = String(req.params.provider || '').toLowerCase();
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error: 'Body brut requis pour la vérification de signature du webhook.',
      });
    }

    const outcome = await handleRawPaymentWebhook(providerName, req.body, req.headers);
    return res.status(outcome.status).json(outcome.body);
  } catch (err) {
    return res.status(400).json({
      error: err.message || 'Échec de vérification du webhook.',
    });
  }
});
