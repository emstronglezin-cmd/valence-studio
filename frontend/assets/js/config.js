/**
 * Configuration publique du Front-End (GitHub Pages).
 * SÉCURITÉ : Ne placez JAMAIS de clé secrète ici. Seule l'URL publique de votre
 * backend Render y figure.
 */
const isGitHubPages = window.location.hostname.endsWith('github.io');

export const STORE_CONFIG = {
  brandName: 'Valence Studio',
  // Sur GitHub Pages, remplacez par l'URL publique de votre service Render :
  apiBaseUrl: isGitHubPages ? 'https://valence-studio.onrender.com' : '',
  defaultCurrency: localStorage.getItem('valence_currency') || 'EUR',
  defaultLocale: localStorage.getItem('valence_locale') || 'fr',
  supportEmail: 'bonjour@valence-studio.com',
};

export function getCurrency() {
  return localStorage.getItem('valence_currency') || 'EUR';
}

export function setCurrency(currency) {
  const safe = currency === 'USD' ? 'USD' : 'EUR';
  localStorage.setItem('valence_currency', safe);
  window.dispatchEvent(new CustomEvent('valence:preferences-changed'));
}

export function getLocale() {
  return localStorage.getItem('valence_locale') || 'fr';
}

export function setLocale(locale) {
  const safe = locale === 'en' ? 'en' : 'fr';
  localStorage.setItem('valence_locale', safe);
  document.documentElement.lang = safe;
  window.dispatchEvent(new CustomEvent('valence:preferences-changed'));
}

export function formatPrice(product, currency = getCurrency()) {
  const cents = currency === 'USD' ? product.price_cents_usd : product.price_cents_eur;
  const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return currency === 'USD' ? `$${amount}` : `${amount} €`;
}
