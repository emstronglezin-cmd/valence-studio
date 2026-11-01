import { STORE_CONFIG } from './config.js';
import { FALLBACK_PRODUCTS, FALLBACK_ARTICLES } from './store-data.js';

function buildApiUrl(path) {
  const base = STORE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
  return `${base}${path}`;
}

export const storeApi = {
  async fetchProducts(category = 'all') {
    try {
      const qs = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
      const res = await fetch(buildApiUrl(`/api/products${qs}`), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('API indisponible');
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        return data.products;
      }
    } catch {
      // Repli instantané sur le catalogue statique embarqué (ex: GitHub Pages avant connexion API)
    }

    return FALLBACK_PRODUCTS.filter(
      (p) => !category || category === 'all' || p.category === category
    );
  },

  async fetchProductBySlug(slug) {
    try {
      const res = await fetch(buildApiUrl(`/api/products/${encodeURIComponent(slug)}`), {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.product) return data.product;
      }
    } catch {
      // Repli statique
    }
    return FALLBACK_PRODUCTS.find((p) => p.slug === slug) || FALLBACK_PRODUCTS[0];
  },

  async createCheckoutSession(payload) {
    const res = await fetch(buildApiUrl('/api/checkout/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.issues?.[0]?.message || data.error || 'Impossible d’initialiser le paiement.';
      throw new Error(detail);
    }
    return data;
  },

  async fetchOrderStatus({ token, sig, orderId }) {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (sig) params.set('sig', sig);
    if (orderId) params.set('order_id', orderId);

    const res = await fetch(buildApiUrl(`/api/checkout/order-status?${params.toString()}`), {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Impossible de récupérer le statut de la commande.');
    }
    return data;
  },

  async subscribeLeadMagnet(payload) {
    const res = await fetch(buildApiUrl('/api/leads/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.issues?.[0]?.message || data.error || 'Inscription impossible.';
      throw new Error(detail);
    }
    return data;
  },

  async fetchSeoArticles() {
    try {
      const res = await fetch(buildApiUrl('/api/seo/articles'), {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.articles) && data.articles.length > 0) {
          return data.articles;
        }
      }
    } catch {
      // Repli statique
    }
    return FALLBACK_ARTICLES;
  },

  async fetchSeoArticleBySlug(slug) {
    try {
      const res = await fetch(buildApiUrl(`/api/seo/articles/${encodeURIComponent(slug)}`), {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.article) return data.article;
      }
    } catch {
      // Repli statique
    }
    return FALLBACK_ARTICLES.find((a) => a.slug === slug) || FALLBACK_ARTICLES[0];
  },

  recordPageVisit() {
    const path = window.location.pathname + window.location.search;
    fetch(buildApiUrl('/api/analytics/visit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: path.slice(0, 190),
        referrer: document.referrer ? document.referrer.slice(0, 380) : null,
      }),
      keepalive: true,
    }).catch(() => {});
  },
};
