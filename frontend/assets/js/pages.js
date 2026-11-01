import {
  getCurrency,
  getLocale,
  formatPrice,
} from './config.js';
import {
  CATEGORY_LABELS,
  renderCategorySchematicSvg,
} from './store-data.js';
import { storeApi } from './api.js';
import { bindTiltCards } from './theme-motion.js';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderProductCardHtml(product) {
  const locale = getLocale();
  const currency = getCurrency();
  const title = locale === 'en' ? product.title_en : product.title_fr;
  const subtitle = locale === 'en' ? product.subtitle_en : product.subtitle_fr;
  const badge = locale === 'en' ? product.badge_en : product.badge_fr;
  const categoryName =
    CATEGORY_LABELS[locale]?.[product.category] || product.category;
  const priceLabel = formatPrice(product, currency);

  return `
    <article data-tilt class="tilt-card surface-card rounded-2xl p-6 flex flex-col justify-between gap-5">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2 tilt-depth">
          <span class="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md surface-subtle">
            ${escapeHtml(product.code)} &bull; ${escapeHtml(categoryName)}
          </span>
          ${
            badge
              ? `<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#2546F0]/10 text-[#2546F0] dark:bg-[#5B78FF]/15 dark:text-[#7C93FF]">${escapeHtml(badge)}</span>`
              : ''
          }
        </div>

        <a href="produit.html?slug=${encodeURIComponent(product.slug)}" class="block group">
          ${renderCategorySchematicSvg(product.category, product.code)}
          <h3 class="mt-4 text-lg font-bold tracking-tight leading-snug group-hover:text-[#2546F0] dark:group-hover:text-[#5B78FF] transition-colors">
            ${escapeHtml(title)}
          </h3>
        </a>

        <p class="text-sm opacity-75 leading-relaxed">
          ${escapeHtml(subtitle)}
        </p>
      </div>

      <div class="pt-4 border-t hairline-border flex items-center justify-between gap-3 tilt-depth">
        <div>
          <div class="text-[11px] font-mono uppercase opacity-55">${locale === 'en' ? 'Instant License' : 'Accès immédiat'}</div>
          <div class="text-xl font-extrabold tabular-nums">${escapeHtml(priceLabel)}</div>
        </div>
        <div class="flex items-center gap-2">
          <a href="produit.html?slug=${encodeURIComponent(product.slug)}" class="px-3.5 py-2 rounded-lg text-xs font-semibold border hairline-border hover:bg-black/5 dark:hover:bg-white/5">
            ${locale === 'en' ? 'Preview' : 'Aperçu'}
          </a>
          <a href="checkout.html?slug=${encodeURIComponent(product.slug)}" class="btn-kinetic px-4 py-2 rounded-lg text-xs font-semibold bg-[#111215] text-white dark:bg-white dark:text-[#090A0D]">
            ${locale === 'en' ? 'Buy' : 'Commander'} <span class="arrow-shift">&rarr;</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   ACCUEIL (index.html)
   -------------------------------------------------------------------------- */
export async function initHomePage() {
  const featuredGrid = document.getElementById('featured-products-grid');
  const articlesGrid = document.getElementById('home-seo-articles');

  const render = async () => {
    const [products, articles] = await Promise.all([
      storeApi.fetchProducts('all'),
      storeApi.fetchSeoArticles(),
    ]);

    if (featuredGrid) {
      const featured = products.filter((p) => p.featured).slice(0, 4);
      featuredGrid.innerHTML = featured.map(renderProductCardHtml).join('');
      bindTiltCards(featuredGrid);
    }

    if (articlesGrid) {
      articlesGrid.innerHTML = articles
        .slice(0, 2)
        .map(
          (a) => `
          <a href="blog.html?slug=${encodeURIComponent(a.slug)}" class="surface-card rounded-2xl p-6 block hover:border-[#2546F0] transition-colors">
            <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF] mb-2">
              Article SEO &bull; ${escapeHtml(String(a.reading_time_minutes || 5))} min
            </div>
            <h3 class="text-lg font-bold leading-snug mb-2">${escapeHtml(a.title)}</h3>
            <p class="text-sm opacity-75 leading-relaxed mb-4">${escapeHtml(a.meta_description)}</p>
            <span class="text-xs font-semibold text-[#2546F0] dark:text-[#5B78FF]">Lire le dossier complet &rarr;</span>
          </a>
        `
        )
        .join('');
    }
  };

  await render();
  window.addEventListener('valence:preferences-changed', render);
}

/* --------------------------------------------------------------------------
   CATALOGUE (catalogue.html)
   -------------------------------------------------------------------------- */
export async function initCatalogPage() {
  const grid = document.getElementById('catalog-products-grid');
  const filterContainer = document.getElementById('catalog-category-filters');
  const searchInput = document.getElementById('catalog-search-input');
  const sortSelect = document.getElementById('catalog-sort-select');
  const countBadge = document.getElementById('catalog-count-badge');

  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get('category') || 'all';
  let searchQuery = '';
  let sortMode = 'featured';

  const allProducts = await storeApi.fetchProducts('all');

  const renderFilters = () => {
    if (!filterContainer) return;
    const locale = getLocale();
    const cats = ['all', 'templates', 'guides', 'prompts', 'directory'];
    filterContainer.innerHTML = cats
      .map((cat) => {
        const isActive = activeCategory === cat;
        return `<button type="button" data-cat="${cat}" class="px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
          isActive
            ? 'bg-[#2546F0] text-white'
            : 'surface-subtle opacity-80 hover:opacity-100'
        }">${escapeHtml(CATEGORY_LABELS[locale]?.[cat] || cat)}</button>`;
      })
      .join('');

    filterContainer.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        renderFilters();
        renderGrid();
      });
    });
  };

  const renderGrid = () => {
    if (!grid) return;
    const locale = getLocale();
    const currency = getCurrency();

    let filtered = allProducts.filter((p) => {
      const catMatch = activeCategory === 'all' || p.category === activeCategory;
      if (!catMatch) return false;
      if (!searchQuery) return true;
      const hay = `${p.title_fr} ${p.title_en} ${p.subtitle_fr} ${p.subtitle_en} ${p.code}`.toLowerCase();
      return hay.includes(searchQuery.toLowerCase());
    });

    filtered = [...filtered].sort((a, b) => {
      const priceKey = currency === 'USD' ? 'price_cents_usd' : 'price_cents_eur';
      if (sortMode === 'price-asc') return a[priceKey] - b[priceKey];
      if (sortMode === 'price-desc') return b[priceKey] - a[priceKey];
      return Number(b.featured) - Number(a.featured);
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} ${
        locale === 'en' ? 'digital assets' : 'actifs disponibles'
      }`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full surface-card rounded-2xl p-12 text-center opacity-75">Aucun produit ne correspond à votre recherche.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(renderProductCardHtml).join('');
    bindTiltCards(grid);
  };

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderGrid();
  });

  sortSelect?.addEventListener('change', (e) => {
    sortMode = e.target.value;
    renderGrid();
  });

  renderFilters();
  renderGrid();
  window.addEventListener('valence:preferences-changed', () => {
    renderFilters();
    renderGrid();
  });
}

/* --------------------------------------------------------------------------
   PAGE PRODUIT (produit.html)
   -------------------------------------------------------------------------- */
export async function initProductPage() {
  const mount = document.getElementById('product-detail-mount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || 'notion-agency-os';
  const product = await storeApi.fetchProductBySlug(slug);

  const render = () => {
    const locale = getLocale();
    const currency = getCurrency();
    const title = locale === 'en' ? product.title_en : product.title_fr;
    const subtitle = locale === 'en' ? product.subtitle_en : product.subtitle_fr;
    const description = locale === 'en' ? product.description_en : product.description_fr;
    const price = formatPrice(product, currency);
    const categoryName = CATEGORY_LABELS[locale]?.[product.category] || product.category;

    document.title = `${title} — Valence Studio`;

    const highlights = Array.isArray(product.highlights) ? product.highlights : [];
    const previews = Array.isArray(product.preview_items) ? product.preview_items : [];
    const faqs = Array.isArray(product.faqs) ? product.faqs : [];

    mount.innerHTML = `
      <div class="mb-6 text-xs font-mono opacity-65 flex items-center gap-2">
        <a href="catalogue.html" class="hover:underline">Catalogue</a>
        <span>/</span>
        <span>${escapeHtml(categoryName)}</span>
        <span>/</span>
        <span>${escapeHtml(product.code)}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div class="lg:col-span-7 space-y-8">
          <div class="surface-card rounded-2xl p-6 sm:p-8">
            <div class="mb-6">${renderCategorySchematicSvg(product.category, product.code)}</div>
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="px-2.5 py-1 rounded-md text-xs font-mono surface-subtle">${escapeHtml(product.code)}</span>
              <span class="px-2.5 py-1 rounded-md text-xs font-mono surface-subtle">Version ${escapeHtml(product.version || '1.0')}</span>
              <span class="px-2.5 py-1 rounded-md text-xs font-mono surface-subtle">${escapeHtml(product.file_size_label)}</span>
            </div>
            <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4">${escapeHtml(title)}</h1>
            <p class="text-base sm:text-lg opacity-80 leading-relaxed mb-6">${escapeHtml(subtitle)}</p>
            <p class="text-sm sm:text-base opacity-75 leading-relaxed">${escapeHtml(description)}</p>
          </div>

          <section class="surface-card rounded-2xl p-6 sm:p-8">
            <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF] mb-2">Aperçu Détaillé du Contenu</div>
            <h2 class="text-xl font-bold mb-5">Ce que vous débloquez à l'intérieur de l'archive</h2>
            <div class="space-y-4">
              ${previews
                .map(
                  (item, idx) => `
                  <div class="p-4 rounded-xl surface-subtle flex items-start gap-4">
                    <span class="w-7 h-7 rounded-lg bg-[#2546F0] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">0${idx + 1}</span>
                    <div>
                      <h3 class="font-bold text-sm mb-1">${escapeHtml(item.title)}</h3>
                      <p class="text-sm opacity-75">${escapeHtml(item.detail)}</p>
                    </div>
                  </div>`
                )
                .join('')}
            </div>
          </section>

          <section class="surface-card rounded-2xl p-6 sm:p-8">
            <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF] mb-2">Questions Fréquentes</div>
            <h2 class="text-xl font-bold mb-5">FAQ Produit &amp; Licence</h2>
            <div class="divide-y hairline-border">
              ${faqs
                .map(
                  (f) => `
                  <details class="faq-item py-4 group">
                    <summary class="flex items-center justify-between gap-4 font-semibold text-sm">
                      <span>${escapeHtml(f.q)}</span>
                      <span class="faq-chevron text-lg font-mono transition-transform">+</span>
                    </summary>
                    <p class="mt-3 text-sm opacity-75 leading-relaxed">${escapeHtml(f.a)}</p>
                  </details>`
                )
                .join('')}
            </div>
          </section>
        </div>

        <aside class="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div class="surface-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div class="flex items-baseline justify-between gap-4 border-b hairline-border pb-5">
              <div>
                <div class="text-xs font-mono uppercase opacity-60">Licence Commerciale Complète</div>
                <div class="text-3xl sm:text-4xl font-extrabold tabular-nums mt-1">${escapeHtml(price)}</div>
              </div>
              <span class="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">En stock numérique</span>
            </div>

            <div>
              <div class="text-xs font-mono uppercase opacity-60 mb-3">Inclus dans votre téléchargement</div>
              <ul class="space-y-2.5 text-sm">
                ${highlights
                  .map(
                    (h) => `
                    <li class="flex items-start gap-2.5">
                      <span class="text-[#2546F0] dark:text-[#5B78FF] font-bold mt-0.5">&#10003;</span>
                      <span>${escapeHtml(h)}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
            </div>

            <div class="p-3.5 rounded-xl surface-subtle text-xs space-y-1">
              <div><strong>Format :</strong> ${escapeHtml(product.file_format)}</div>
              <div><strong>Livraison :</strong> Lien signé privé par email (24h, 3 téléchargements max)</div>
            </div>

            <a href="checkout.html?slug=${encodeURIComponent(product.slug)}" class="btn-kinetic w-full py-3.5 px-6 rounded-xl bg-[#2546F0] hover:bg-[#1B37CC] text-white font-semibold text-sm flex items-center justify-center gap-2">
              <span>Accéder au Checkout Sécurisé</span>
              <span class="arrow-shift">&rarr;</span>
            </a>

            <div class="grid grid-cols-3 gap-2 pt-2 text-center text-[11px] opacity-70">
              <div class="p-2 rounded-lg surface-subtle">Paiement chiffré</div>
              <div class="p-2 rounded-lg surface-subtle">Facture B2B</div>
              <div class="p-2 rounded-lg surface-subtle">Accès &lt; 15 sec</div>
            </div>
          </div>

          <div class="surface-card rounded-2xl p-6 space-y-3">
            <h3 class="font-bold text-sm flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Garanties Valence Studio
            </h3>
            <p class="text-xs opacity-75 leading-relaxed">
              <strong>1. Conformité &amp; Intégrité :</strong> chaque archive est vérifiée et hébergée sur stockage chiffré privé. En cas de lien expiré ou de souci technique de réception, notre support réémet votre accès sous 2h ouvrées.
            </p>
            <p class="text-xs opacity-75 leading-relaxed">
              <strong>2. Mises à jour incluses :</strong> toutes les révisions mineures de la version achetée vous sont communiquées sans surcoût.
            </p>
          </div>
        </aside>
      </div>
    `;
  };

  render();
  window.addEventListener('valence:preferences-changed', render);
}

/* --------------------------------------------------------------------------
   CHECKOUT (checkout.html)
   -------------------------------------------------------------------------- */
export async function initCheckoutPage() {
  const summaryMount = document.getElementById('checkout-product-summary');
  const form = document.getElementById('checkout-form');
  const productSelect = document.getElementById('checkout-product-select');
  const errorBox = document.getElementById('checkout-error');
  const submitBtn = document.getElementById('checkout-submit-btn');
  const canceledBanner = document.getElementById('checkout-canceled-banner');

  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  let activeSlug = params.get('slug') || 'notion-agency-os';
  if (params.get('canceled') === '1' && canceledBanner) {
    canceledBanner.classList.remove('hidden');
  }

  const products = await storeApi.fetchProducts('all');
  let selectedProduct = products.find((p) => p.slug === activeSlug) || products[0];

  if (productSelect) {
    productSelect.innerHTML = products
      .map(
        (p) =>
          `<option value="${escapeHtml(p.slug)}" ${
            p.slug === selectedProduct.slug ? 'selected' : ''
          }>${escapeHtml(p.code)} — ${escapeHtml(p.title_fr)}</option>`
      )
      .join('');

    productSelect.addEventListener('change', (e) => {
      selectedProduct = products.find((p) => p.slug === e.target.value) || products[0];
      renderSummary();
    });
  }

  const renderSummary = () => {
    if (!summaryMount || !selectedProduct) return;
    const currency = getCurrency();
    const price = formatPrice(selectedProduct, currency);

    summaryMount.innerHTML = `
      <div class="space-y-4">
        ${renderCategorySchematicSvg(selectedProduct.category, selectedProduct.code)}
        <div>
          <span class="text-xs font-mono opacity-60">${escapeHtml(selectedProduct.code)}</span>
          <h2 class="text-lg font-bold leading-snug mt-1">${escapeHtml(selectedProduct.title_fr)}</h2>
          <p class="text-xs opacity-70 mt-1">${escapeHtml(selectedProduct.file_format)}</p>
        </div>
        <div class="pt-4 border-t hairline-border space-y-2 text-sm">
          <div class="flex justify-between opacity-75">
            <span>Licence numérique internationale</span>
            <span class="tabular-nums">${escapeHtml(price)}</span>
          </div>
          <div class="flex justify-between opacity-75">
            <span>Livraison par URL signée privée (Brevo)</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">Incluse</span>
          </div>
          <div class="flex justify-between font-extrabold text-lg pt-3 border-t hairline-border">
            <span>Total à régler (${escapeHtml(currency)})</span>
            <span class="tabular-nums">${escapeHtml(price)}</span>
          </div>
        </div>
      </div>
    `;
  };

  renderSummary();
  window.addEventListener('valence:preferences-changed', renderSummary);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorBox) errorBox.classList.add('hidden');

    const formData = new FormData(form);
    const payload = {
      productSlug: selectedProduct.slug,
      customerEmail: String(formData.get('customerEmail') || '').trim(),
      customerName: String(formData.get('customerName') || '').trim() || undefined,
      companyName: String(formData.get('companyName') || '').trim() || undefined,
      countryCode: String(formData.get('countryCode') || 'FR').trim(),
      currency: getCurrency(),
      provider: String(formData.get('provider') || 'saspay'),
      waiverAccepted: formData.get('waiverAccepted') === 'on',
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Initialisation de la session chiffrée...';
      const session = await storeApi.createCheckoutSession(payload);
      window.location.href = session.checkoutUrl;
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Procéder au paiement sécurisé';
    }
  });
}

/* --------------------------------------------------------------------------
   MERCI / TÉLÉCHARGEMENT (merci.html)
   -------------------------------------------------------------------------- */
export async function initThankYouPage() {
  const mount = document.getElementById('thank-you-mount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const sig = params.get('sig') || '';
  const orderId = params.get('order_id') || '';

  if (!token && !orderId) {
    mount.innerHTML = `
      <div class="surface-card rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
        <div class="text-xs font-mono uppercase opacity-60">Aucune session active</div>
        <h1 class="text-2xl font-bold">Consultez votre boîte email</h1>
        <p class="text-sm opacity-75">Dès validation de votre paiement, votre lien de téléchargement signé (valable 24h, 3 téléchargements maximum) est envoyé directement à votre adresse email.</p>
        <a href="catalogue.html" class="inline-block px-5 py-2.5 rounded-lg bg-[#2546F0] text-white text-sm font-semibold">Retour au catalogue</a>
      </div>
    `;
    return;
  }

  const refreshStatus = async () => {
    try {
      const data = await storeApi.fetchOrderStatus({ token, sig, orderId });
      const order = data.order || {};
      const delivery = data.delivery;

      if (data.status !== 'paid' || !delivery) {
        mount.innerHTML = `
          <div class="surface-card rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
            <div class="text-xs font-mono uppercase text-amber-500">Confirmation webhook en cours</div>
            <h1 class="text-2xl font-bold">Commande ${escapeHtml(order.order_number || '')} reçue</h1>
            <p class="text-sm opacity-75">Nous vérifions la signature cryptographique de votre paiement. Votre lien privé arrive par email dans quelques secondes.</p>
          </div>
        `;
        return;
      }

      const exhausted = delivery.remainingDownloads <= 0;
      const expiresDate = new Date(delivery.expiresAt).toLocaleString('fr-FR');

      mount.innerHTML = `
        <div class="surface-card rounded-2xl p-8 sm:p-10 max-w-2xl mx-auto space-y-6">
          <div class="flex items-center justify-between gap-4 border-b hairline-border pb-6">
            <div>
              <span class="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-emerald-600 dark:text-emerald-400">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Paiement vérifié &amp; Livraison active
              </span>
              <h1 class="text-2xl sm:text-3xl font-extrabold mt-1">Merci pour votre confiance.</h1>
            </div>
            <div class="text-right font-mono text-xs opacity-70">
              <div>Réf. ${escapeHtml(order.order_number || 'LIVRAISON')}</div>
              ${
                order.amount_cents
                  ? `<div class="font-bold text-sm mt-0.5">${(order.amount_cents / 100).toFixed(2)} ${escapeHtml(order.currency)}</div>`
                  : ''
              }
            </div>
          </div>

          <div class="p-5 rounded-xl surface-subtle space-y-2">
            <div class="text-xs font-mono uppercase opacity-60">Archive débloquée</div>
            <div class="font-bold text-base">${escapeHtml(order.product_title || delivery.fileName)}</div>
            <div class="flex flex-wrap gap-4 pt-2 text-xs font-mono">
              <span>Quota restant : <strong id="remaining-dl-badge">${delivery.remainingDownloads} / ${delivery.maxDownloads}</strong></span>
              <span>Expire le : <strong>${escapeHtml(expiresDate)} (24h)</strong></span>
            </div>
          </div>

          <div>
            ${
              exhausted
                ? `<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
                    Quota maximal de ${delivery.maxDownloads} téléchargements atteint pour ce jeton.
                  </div>`
                : `<a id="trigger-secure-download" href="${escapeHtml(delivery.signedDownloadUrl)}" class="btn-kinetic w-full py-4 px-6 rounded-xl bg-[#2546F0] hover:bg-[#1B37CC] text-white font-semibold text-sm flex items-center justify-center gap-2">
                    <span>Télécharger mon fichier privé (${escapeHtml(delivery.fileName)})</span>
                    <span class="arrow-shift">&darr;</span>
                  </a>`
            }
          </div>

          <p class="text-xs opacity-65 leading-relaxed">
            Une copie de ce lien signé a également été transmise à <strong>${escapeHtml(order.customer_email || 'votre adresse email')}</strong> via Brevo. Conservez l'archive téléchargée sur votre poste de travail.
          </p>
        </div>
      `;

      const dlBtn = document.getElementById('trigger-secure-download');
      dlBtn?.addEventListener('click', () => {
        window.setTimeout(refreshStatus, 900);
      });
    } catch (err) {
      mount.innerHTML = `
        <div class="surface-card rounded-2xl p-8 max-w-xl mx-auto text-center space-y-3">
          <h1 class="text-xl font-bold">Accès expiré ou introuvable</h1>
          <p class="text-sm opacity-75">${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  };

  await refreshStatus();
}

/* --------------------------------------------------------------------------
   LEAD MAGNET (ressource-gratuite.html & formulaires d'accueil)
   -------------------------------------------------------------------------- */
export function initLeadMagnetForms() {
  const params = new URLSearchParams(window.location.search);
  const confirmedBanner = document.getElementById('lead-confirmed-banner');
  const confirmedDownloadLink = document.getElementById('lead-confirmed-download');

  if (params.get('confirmed') === '1' && confirmedBanner) {
    confirmedBanner.classList.remove('hidden');
    const dlUrl = params.get('download');
    if (dlUrl && confirmedDownloadLink) {
      confirmedDownloadLink.href = dlUrl;
      confirmedDownloadLink.classList.remove('hidden');
    }
  }

  document.querySelectorAll('[data-lead-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const feedback = form.querySelector('[data-lead-feedback]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);

      const payload = {
        email: String(formData.get('email') || '').trim(),
        firstName: String(formData.get('firstName') || '').trim() || undefined,
        locale: getLocale(),
        consentGiven: formData.get('consentGiven') === 'on',
      };

      try {
        if (submitBtn) submitBtn.disabled = true;
        const result = await storeApi.subscribeLeadMagnet(payload);
        if (feedback) {
          feedback.className =
            'mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-2';
          feedback.innerHTML = `<p class="font-medium">${escapeHtml(result.message)}</p>${
            result.devConfirmUrl
              ? `<p class="text-xs font-mono pt-1"><a href="${escapeHtml(result.devConfirmUrl)}" class="underline text-[#2546F0] dark:text-[#5B78FF]">[Mode Aperçu Local] Cliquer ici pour simuler le clic email Double Opt-In &rarr;</a></p>`
              : ''
          }`;
          feedback.classList.remove('hidden');
        }
        form.reset();
      } catch (err) {
        if (feedback) {
          feedback.className =
            'mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400';
          feedback.textContent = err.message;
          feedback.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
}

/* --------------------------------------------------------------------------
   JOURNAL SEO & LECTEUR D'ARTICLES (blog.html)
   -------------------------------------------------------------------------- */
export async function initBlogPage() {
  const listMount = document.getElementById('seo-articles-list');
  const readerMount = document.getElementById('seo-article-reader');
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (slug && readerMount) {
    if (listMount) listMount.classList.add('hidden');
    readerMount.classList.remove('hidden');

    const article = await storeApi.fetchSeoArticleBySlug(slug);
    document.title = `${article.meta_title || article.title} — Valence Studio`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = article.meta_description || '';

    // Injection des données structurées Schema.org Article
    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.meta_description,
      datePublished: article.published_at,
      author: { '@type': 'Organization', name: 'Valence Studio' },
    });
    document.head.appendChild(ldScript);

    const outline = Array.isArray(article.outline) ? article.outline : [];
    const faqs = Array.isArray(article.faq_items) ? article.faq_items : [];

    readerMount.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-8">
        <a href="blog.html" class="inline-flex items-center gap-2 text-xs font-mono opacity-70 hover:opacity-100">&larr; Retour à tous les articles SEO</a>
        <div>
          <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF] mb-3">
            Dossier Éditorial &bull; ${escapeHtml(String(article.reading_time_minutes || 5))} min de lecture
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4">${escapeHtml(article.title)}</h1>
          <p class="text-lg opacity-75 leading-relaxed">${escapeHtml(article.meta_description)}</p>
        </div>

        ${
          outline.length > 0
            ? `<div class="p-5 rounded-2xl surface-subtle space-y-2">
                <div class="text-xs font-mono uppercase opacity-60">Sommaire de l'article</div>
                <ul class="text-sm space-y-1.5 font-medium">
                  ${outline.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>`
            : ''
        }

        <article class="surface-card rounded-2xl p-6 sm:p-10 space-y-5 leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2">
          ${article.content_html}
        </article>

        ${
          faqs.length > 0
            ? `<section class="surface-card rounded-2xl p-6 sm:p-8 space-y-4">
                <h2 class="text-xl font-bold">Questions fréquentes</h2>
                ${faqs
                  .map(
                    (f) => `<div class="p-4 rounded-xl surface-subtle">
                      <h3 class="font-semibold text-sm mb-1">${escapeHtml(f.question)}</h3>
                      <p class="text-sm opacity-75">${escapeHtml(f.answer)}</p>
                    </div>`
                  )
                  .join('')}
              </section>`
            : ''
        }
      </div>
    `;
    return;
  }

  if (listMount) {
    const articles = await storeApi.fetchSeoArticles();
    listMount.innerHTML = articles
      .map(
        (a) => `
        <article class="surface-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div class="space-y-3">
            <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF]">
              ${escapeHtml((a.published_at || '').slice(0, 10) || '2026')} &bull; ${escapeHtml(String(a.reading_time_minutes || 5))} min
            </div>
            <h2 class="text-xl font-bold leading-snug">
              <a href="blog.html?slug=${encodeURIComponent(a.slug)}" class="hover:text-[#2546F0] dark:hover:text-[#5B78FF]">${escapeHtml(a.title)}</a>
            </h2>
            <p class="text-sm opacity-75 leading-relaxed">${escapeHtml(a.meta_description)}</p>
          </div>
          <div class="flex items-center justify-between pt-4 border-t hairline-border text-xs font-semibold">
            <a href="blog.html?slug=${encodeURIComponent(a.slug)}" class="text-[#2546F0] dark:text-[#5B78FF]">Lire l'article &rarr;</a>
            <a href="articles/${encodeURIComponent(a.slug)}.html" class="font-mono opacity-60 hover:opacity-100">Version HTML statique</a>
          </div>
        </article>`
      )
      .join('');
  }
}
