/**
 * Contrat abstrait de passerelle de paiement internationale.
 * Toute implémentation (Saspay, Stripe, ou futur PSP) hérite de cette interface.
 */
export class PaymentProvider {
  constructor() {
    if (new.target === PaymentProvider) {
      throw new Error('PaymentProvider est une classe abstraite et ne peut pas être instanciée directement.');
    }
  }

  /**
   * Identifiant unique du provider ('saspay', 'stripe', ...)
   * @returns {string}
   */
  getName() {
    throw new Error('La méthode getName() doit être implémentée.');
  }

  /**
   * Indique si les clés API de production du provider sont configurées.
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('La méthode isConfigured() doit être implémentée.');
  }

  /**
   * Crée une session de paiement hébergée et retourne l'URL de redirection.
   * @param {object} params
   * @returns {Promise<{ sessionId: string, checkoutUrl: string, sandbox?: boolean }>}
   */
  async createCheckoutSession(_params) {
    throw new Error('La méthode createCheckoutSession() doit être implémentée.');
  }

  /**
   * Vérifie la signature cryptographique sur le body brut (Buffer) du webhook
   * et normalise l'événement métier.
   * @param {Buffer} _rawBodyBuffer
   * @param {Record<string, string | string[] | undefined>} _headers
   * @returns {Promise<{
   *   eventId: string,
   *   eventType: 'payment.succeeded' | 'payment.failed' | 'ignored',
   *   orderId: string | null,
   *   orderNumber: string | null,
   *   providerSessionId: string | null,
   *   providerPaymentId: string | null,
   *   rawEvent: object
   * }>}
   */
  async verifyAndParseWebhook(_rawBodyBuffer, _headers) {
    throw new Error('La méthode verifyAndParseWebhook() doit être implémentée.');
  }
}
