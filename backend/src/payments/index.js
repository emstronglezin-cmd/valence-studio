import { SaspayProvider } from './SaspayProvider.js';
import { StripeProvider } from './StripeProvider.js';
import { env } from '../config/env.js';

const providers = new Map([
  ['saspay', new SaspayProvider()],
  ['stripe', new StripeProvider()],
]);

export function getPaymentProvider(name = env.payments.defaultProvider) {
  const key = String(name || env.payments.defaultProvider).toLowerCase();
  const provider = providers.get(key);
  if (!provider) {
    throw new Error(`Provider de paiement non supporté : ${key}`);
  }
  return provider;
}

export function listAvailablePaymentProviders() {
  return Array.from(providers.values()).map((provider) => ({
    name: provider.getName(),
    configured: provider.isConfigured(),
    sandboxAvailable: env.payments.sandboxMode,
  }));
}
