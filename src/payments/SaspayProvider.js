import crypto from 'node:crypto';
import { PaymentProvider } from './PaymentProvider.js';
import { env } from '../config/env.js';

export class SaspayProvider extends PaymentProvider {
  constructor(config = env.payments.saspay) {
    super();
    this.config = config;
  }

  getName() {
    return 'saspay';
  }

  isConfigured() {
    return Boolean(
      this.config.apiKey && this.config.merchantId && this.config.webhookSecret
    );
  }

  /**
   * Calcule la signature HMAC-SHA256 sur le payload brut (avec ou sans timestamp).
   */
  computeSignature(rawPayloadBuffer, secret, timestamp = '') {
    const hmac = crypto.createHmac('sha256', secret);
    if (timestamp) {
      hmac.update(`${timestamp}.`, 'utf8');
    }
    hmac.update(rawPayloadBuffer);
    return hmac.digest('hex');
  }

  async createCheckoutSession({ order, product, successUrl, cancelUrl, webhookUrl }) {
    if (!this.isConfigured()) {
      if (env.payments.sandboxMode) {
        const sandboxSessionId = `saspay_sbx_${crypto.randomBytes(10).toString('hex')}`;
        const sandboxSig = crypto
          .createHmac('sha256', env.appHmacSecret)
          .update(`${order.id}:${sandboxSessionId}`)
          .digest('hex');
        const sandboxUrl = `${env.browserApiPrefix}/api/checkout/sandbox-complete?provider=saspay&order_id=${encodeURIComponent(order.id)}&session_id=${encodeURIComponent(sandboxSessionId)}&sig=${sandboxSig}`;
        return {
          sessionId: sandboxSessionId,
          checkoutUrl: sandboxUrl,
          sandbox: true,
        };
      }
      throw new Error(
        'Saspay non configuré : renseignez SASPAY_API_KEY, SASPAY_MERCHANT_ID et SASPAY_WEBHOOK_SECRET dans .env.'
      );
    }

    const requestPayload = {
      merchant_id: this.config.merchantId,
      reference: order.order_number,
      order_id: order.id,
      amount: order.amount_cents,
      currency: order.currency,
      description: product.title_fr,
      customer: {
        email: order.customer_email,
        name: order.customer_name || undefined,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        product_slug: order.product_slug,
      },
    };

    const bodyJson = JSON.stringify(requestPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const requestSig = this.computeSignature(
      Buffer.from(bodyJson, 'utf8'),
      this.config.apiKey,
      timestamp
    );

    const endpoint = `${this.config.apiBaseUrl}${this.config.checkoutPath}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'X-Merchant-Id': this.config.merchantId,
        'X-Saspay-Timestamp': timestamp,
        'X-Saspay-Signature': requestSig,
      },
      body: bodyJson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API Saspay (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    const sessionId = data.session_id || data.id || data.data?.id;
    const checkoutUrl =
      data.checkout_url || data.payment_url || data.redirect_url || data.data?.checkout_url;

    if (!sessionId || !checkoutUrl) {
      throw new Error('Réponse Saspay incomplète : session_id ou checkout_url manquant.');
    }

    return {
      sessionId: String(sessionId),
      checkoutUrl: String(checkoutUrl),
      sandbox: false,
    };
  }

  async verifyAndParseWebhook(rawBodyBuffer, headers) {
    if (!Buffer.isBuffer(rawBodyBuffer)) {
      throw new Error('Le body du webhook Saspay doit être un Buffer brut non modifié.');
    }

    const secret = this.config.webhookSecret || (env.payments.sandboxMode ? env.appHmacSecret : '');
    if (!secret) {
      throw new Error('SASPAY_WEBHOOK_SECRET non configuré.');
    }

    const rawHeader = headers[this.config.signatureHeader] || headers['x-saspay-signature'];
    const signatureHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new Error(`En-tête de signature ${this.config.signatureHeader} manquant.`);
    }

    // Supporte les deux schémas standards :
    //   Format A : "t=1730000000,v1=abcdef..." (horodaté anti-rejeu)
    //   Format B : "abcdef..." ou "sha256=abcdef..." (HMAC direct sur body brut)
    let timestamp = '';
    let receivedHex = signatureHeader.trim();

    if (receivedHex.includes('v1=')) {
      const parts = Object.fromEntries(
        receivedHex.split(',').map((segment) => {
          const [k, v] = segment.trim().split('=');
          return [k, v];
        })
      );
      timestamp = parts.t || '';
      receivedHex = parts.v1 || '';

      if (timestamp) {
        const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
        if (Number.isNaN(ageSeconds) || ageSeconds > 300) {
          throw new Error('Horodatage du webhook Saspay expiré (tolérance 5 minutes).');
        }
      }
    } else if (receivedHex.startsWith('sha256=')) {
      receivedHex = receivedHex.slice(7);
    }

    const expectedHex = this.computeSignature(rawBodyBuffer, secret, timestamp);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const receivedBuf = Buffer.from(receivedHex, 'hex');

    if (
      expectedBuf.length === 0 ||
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new Error('Signature cryptographique du webhook Saspay invalide.');
    }

    const payload = JSON.parse(rawBodyBuffer.toString('utf8'));
    const rawType = String(payload.event || payload.type || '').toLowerCase();

    let eventType = 'ignored';
    if (['payment.succeeded', 'payment.completed', 'checkout.completed', 'charge.succeeded'].includes(rawType)) {
      eventType = 'payment.succeeded';
    } else if (['payment.failed', 'charge.failed'].includes(rawType)) {
      eventType = 'payment.failed';
    }

    const dataObj = payload.data || payload.object || payload;
    const metadata = dataObj.metadata || payload.metadata || {};

    return {
      eventId: String(payload.id || payload.event_id || `${rawType}:${dataObj.id}`),
      eventType,
      orderId: metadata.order_id || dataObj.order_id || null,
      orderNumber: metadata.order_number || dataObj.reference || null,
      providerSessionId: dataObj.session_id || dataObj.id || null,
      providerPaymentId: dataObj.payment_id || dataObj.transaction_id || dataObj.id || null,
      rawEvent: payload,
    };
  }
}
