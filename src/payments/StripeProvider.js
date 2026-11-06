import crypto from 'node:crypto';
import Stripe from 'stripe';
import { PaymentProvider } from './PaymentProvider.js';
import { env } from '../config/env.js';

export class StripeProvider extends PaymentProvider {
  constructor(config = env.payments.stripe) {
    super();
    this.config = config;
    this.stripe = config.secretKey
      ? new Stripe(config.secretKey, { apiVersion: '2024-12-18.acacia' })
      : null;
  }

  getName() {
    return 'stripe';
  }

  isConfigured() {
    return Boolean(this.config.secretKey && this.config.webhookSecret);
  }

  async createCheckoutSession({ order, product, successUrl, cancelUrl }) {
    if (!this.stripe) {
      if (env.payments.sandboxMode) {
        const sandboxSessionId = `cs_sbx_${crypto.randomBytes(10).toString('hex')}`;
        const sandboxSig = crypto
          .createHmac('sha256', env.appHmacSecret)
          .update(`${order.id}:${sandboxSessionId}`)
          .digest('hex');
        const sandboxUrl = `${env.browserApiPrefix}/api/checkout/sandbox-complete?provider=stripe&order_id=${encodeURIComponent(order.id)}&session_id=${encodeURIComponent(sandboxSessionId)}&sig=${sandboxSig}`;
        return {
          sessionId: sandboxSessionId,
          checkoutUrl: sandboxUrl,
          sandbox: true,
        };
      }
      throw new Error(
        'Stripe non configuré : renseignez STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans .env.'
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.customer_email,
      client_reference_id: order.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: order.amount_cents,
            product_data: {
              name: product.title_fr,
              description: product.subtitle_fr,
              metadata: {
                product_slug: product.slug,
                code: product.code,
              },
            },
          },
        },
      ],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        product_slug: order.product_slug,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      sandbox: false,
    };
  }

  async verifyAndParseWebhook(rawBodyBuffer, headers) {
    if (!Buffer.isBuffer(rawBodyBuffer)) {
      throw new Error('Le body du webhook Stripe doit être un Buffer brut non modifié.');
    }

    if (!this.stripe || !this.config.webhookSecret) {
      if (env.payments.sandboxMode) {
        const sigHeader = headers['stripe-signature'];
        const expected = crypto
          .createHmac('sha256', env.appHmacSecret)
          .update(rawBodyBuffer)
          .digest('hex');
        if (!sigHeader || sigHeader !== expected) {
          throw new Error('Signature sandbox Stripe invalide.');
        }
        const parsed = JSON.parse(rawBodyBuffer.toString('utf8'));
        const obj = parsed.data?.object || {};
        return {
          eventId: parsed.id,
          eventType: parsed.type === 'checkout.session.completed' ? 'payment.succeeded' : 'ignored',
          orderId: obj.metadata?.order_id || obj.client_reference_id || null,
          orderNumber: obj.metadata?.order_number || null,
          providerSessionId: obj.id || null,
          providerPaymentId: obj.payment_intent || obj.id || null,
          rawEvent: parsed,
        };
      }
      throw new Error('STRIPE_WEBHOOK_SECRET non configuré.');
    }

    const signature = headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new Error('En-tête Stripe-Signature manquant.');
    }

    const event = this.stripe.webhooks.constructEvent(
      rawBodyBuffer,
      signature,
      this.config.webhookSecret
    );

    let eventType = 'ignored';
    if (event.type === 'checkout.session.completed') {
      eventType = 'payment.succeeded';
    } else if (event.type === 'payment_intent.payment_failed') {
      eventType = 'payment.failed';
    }

    const sessionObj = event.data?.object || {};
    return {
      eventId: event.id,
      eventType,
      orderId: sessionObj.metadata?.order_id || sessionObj.client_reference_id || null,
      orderNumber: sessionObj.metadata?.order_number || null,
      providerSessionId: sessionObj.id || null,
      providerPaymentId:
        typeof sessionObj.payment_intent === 'string'
          ? sessionObj.payment_intent
          : sessionObj.id || null,
      rawEvent: event,
    };
  }
}
