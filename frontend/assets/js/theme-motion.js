import {
  getCurrency,
  setCurrency,
  getLocale,
  setLocale,
} from './config.js';
import { storeApi } from './api.js';

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* --------------------------------------------------------------------------
   1. GESTION DU THÈME (PRÉFÉRENCE SYSTÈME PAR DÉFAUT + BASCULE MANUELLE)
   -------------------------------------------------------------------------- */
export function applyThemeFromPreference() {
  const saved = localStorage.getItem('valence_theme') || 'system';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = saved === 'dark' || (saved === 'system' && systemDark);
  document.documentElement.classList.toggle('dark', shouldBeDark);
  updateThemeButtonLabel(saved, shouldBeDark);
}

function updateThemeButtonLabel(mode, isDark) {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const label =
      mode === 'system'
        ? `Auto (${isDark ? 'Sombre' : 'Clair'})`
        : mode === 'dark'
          ? 'Sombre'
          : 'Clair';
    btn.setAttribute('aria-label', `Thème d'affichage : ${label}`);
    const span = btn.querySelector('[data-theme-label]');
    if (span) span.textContent = label;
  });
}

export function cycleTheme() {
  const current = localStorage.getItem('valence_theme') || 'system';
  const next = current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
  localStorage.setItem('valence_theme', next);
  applyThemeFromPreference();
}

/* --------------------------------------------------------------------------
   2. NAVIGATION PARTAGÉE & PIED DE PAGE INTERNATIONAL
   -------------------------------------------------------------------------- */
export function renderSharedChrome(activePage = '') {
  const headerMount = document.getElementById('site-header');
  const footerMount = document.getElementById('site-footer');
  const locale = getLocale();
  const currency = getCurrency();

  if (headerMount) {
    const t =
      locale === 'en'
        ? {
            home: 'Home',
            catalog: 'Catalog',
            freeKit: 'Free Kit',
            journal: 'Journal',
            cta: 'Explore Assets',
          }
        : {
            home: 'Accueil',
            catalog: 'Catalogue',
            freeKit: 'Extrait Gratuit',
            journal: 'Journal SEO',
            cta: 'Voir le Catalogue',
          };

    const navLinkClass = (id) =>
      `text-sm font-medium transition-opacity ${
        activePage === id ? 'opacity-100 text-[#2546F0] dark:text-[#5B78FF]' : 'opacity-75 hover:opacity-100'
      }`;

    headerMount.innerHTML = `
      <header class="sticky top-0 z-40 backdrop-blur-md bg-[#F7F6F2]/88 dark:bg-[#090A0D]/88 border-b hairline-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a href="index.html" class="flex items-center gap-2.5 group" aria-label="Valence Studio Accueil">
            <span class="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#090A0D] flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
              VS
            </span>
            <span class="font-bold tracking-[0.14em] text-xs uppercase">Valence Studio</span>
          </a>

          <nav class="hidden md:flex items-center gap-7" aria-label="Navigation principale">
            <a href="index.html" class="${navLinkClass('home')}">${t.home}</a>
            <a href="catalogue.html" class="${navLinkClass('catalog')}">${t.catalog}</a>
            <a href="ressource-gratuite.html" class="${navLinkClass('lead')}">${t.freeKit}</a>
            <a href="blog.html" class="${navLinkClass('blog')}">${t.journal}</a>
          </nav>

          <div class="flex items-center gap-2 sm:gap-2.5">
            <button type="button" data-currency-toggle class="px-2.5 py-1.5 rounded-lg text-xs font-mono border hairline-border hover:bg-black/5 dark:hover:bg-white/5 tabular-nums" aria-label="Changer la devise">
              ${currency}
            </button>
            <button type="button" data-locale-toggle class="px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase border hairline-border hover:bg-black/5 dark:hover:bg-white/5" aria-label="Changer la langue">
              ${locale.toUpperCase()}
            </button>
            <button type="button" data-theme-toggle class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border hairline-border hover:bg-black/5 dark:hover:bg-white/5">
              <span class="w-2 h-2 rounded-full bg-[#2546F0] dark:bg-[#5B78FF]"></span>
              <span data-theme-label>Auto</span>
            </button>
            <a href="catalogue.html" class="hidden sm:inline-flex btn-kinetic items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2546F0] hover:bg-[#1B37CC] text-white text-xs font-semibold">
              <span>${t.cta}</span>
              <span class="arrow-shift">&rarr;</span>
            </a>
            <button type="button" id="mobile-menu-btn" class="md:hidden p-2 rounded-lg border hairline-border" aria-label="Ouvrir le menu mobile" aria-expanded="false">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
          </div>
        </div>

        <div id="mobile-menu-drawer" class="hidden md:hidden border-t hairline-border px-4 py-4 space-y-3 bg-[#F7F6F2] dark:bg-[#090A0D]">
          <a href="index.html" class="block py-1.5 text-sm font-medium">${t.home}</a>
          <a href="catalogue.html" class="block py-1.5 text-sm font-medium">${t.catalog}</a>
          <a href="ressource-gratuite.html" class="block py-1.5 text-sm font-medium">${t.freeKit}</a>
          <a href="blog.html" class="block py-1.5 text-sm font-medium">${t.journal}</a>
          <button type="button" data-theme-toggle class="w-full text-left py-1.5 text-xs font-mono opacity-80">
            Thème : <span data-theme-label>Auto</span>
          </button>
        </div>
      </header>
    `;
  }

  if (footerMount) {
    footerMount.innerHTML = `
      <footer class="border-t hairline-border mt-24 bg-black/[0.015] dark:bg-white/[0.015]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div class="md:col-span-2 space-y-3">
              <div class="flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-md bg-[#111215] dark:bg-white text-white dark:text-[#090A0D] flex items-center justify-center font-mono text-xs font-bold">VS</span>
                <span class="font-bold tracking-[0.14em] text-xs uppercase">Valence Studio</span>
              </div>
              <p class="text-sm opacity-70 max-w-md leading-relaxed">
                Boutique internationale d'actifs numériques B2B : systèmes Notion, playbooks d'acquisition, matrices de prompts IA et annuaires professionnels vérifiés. Livraison instantanée par URL signée privée.
              </p>
              <div class="flex items-center gap-3 pt-1 text-xs font-mono opacity-60">
                <span>SASPAY &amp; STRIPE READY</span>
                <span>&bull;</span>
                <span>SUPABASE PRIVATE STORAGE</span>
                <span>&bull;</span>
                <span>EUR / USD</span>
              </div>
            </div>

            <div>
              <h3 class="text-xs font-mono uppercase tracking-widest opacity-60 mb-4">Catalogue</h3>
              <ul class="space-y-2.5 text-sm opacity-80">
                <li><a href="catalogue.html?category=templates" class="hover:opacity-100">Templates &amp; Systèmes</a></li>
                <li><a href="catalogue.html?category=guides" class="hover:opacity-100">Guides &amp; Playbooks</a></li>
                <li><a href="catalogue.html?category=prompts" class="hover:opacity-100">Packs de Prompts IA</a></li>
                <li><a href="catalogue.html?category=directory" class="hover:opacity-100">Annuaires B2B Vérifiés</a></li>
              </ul>
            </div>

            <div>
              <h3 class="text-xs font-mono uppercase tracking-widest opacity-60 mb-4">Informations &amp; Légal</h3>
              <ul class="space-y-2.5 text-sm opacity-80">
                <li><a href="ressource-gratuite.html" class="hover:opacity-100">Kit Opérateur Gratuit</a></li>
                <li><a href="blog.html" class="hover:opacity-100">Articles SEO &amp; Méthodes</a></li>
                <li><a href="mentions-legales.html" class="hover:opacity-100">Mentions légales &amp; CGV</a></li>
                <li><a href="mentions-legales.html#confidentialite" class="hover:opacity-100">RGPD &amp; Désinscription</a></li>
                <li><a href="admin.html" class="hover:opacity-100 font-mono text-xs opacity-60">Console Admin</a></li>
              </ul>
            </div>
          </div>

          <div class="mt-12 pt-6 border-t hairline-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-60">
            <p>&copy; ${new Date().getUTCFullYear()} Valence Studio. Tous droits réservés — Distribution internationale.</p>
            <p class="font-mono">SHA-256 Webhook Verified &bull; Livraison 24h / 3 Téléchargements Max</p>
          </div>
        </div>
      </footer>
    `;
  }

  bindChromeControls(activePage);
  applyThemeFromPreference();
}

function bindChromeControls(activePage) {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', cycleTheme);
  });

  document.querySelectorAll('[data-currency-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCurrency(getCurrency() === 'EUR' ? 'USD' : 'EUR');
      renderSharedChrome(activePage);
    });
  });

  document.querySelectorAll('[data-locale-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLocale(getLocale() === 'fr' ? 'en' : 'fr');
      renderSharedChrome(activePage);
    });
  });

  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobile-menu-drawer');
  if (mobileBtn && mobileDrawer) {
    mobileBtn.addEventListener('click', () => {
      const hidden = mobileDrawer.classList.toggle('hidden');
      mobileBtn.setAttribute('aria-expanded', String(!hidden));
    });
  }
}

/* --------------------------------------------------------------------------
   3. CARTES PRODUITS AVEC EFFET 3D / TILT AU SURVOL
   -------------------------------------------------------------------------- */
export function bindTiltCards(root = document) {
  if (prefersReducedMotion()) return;

  root.querySelectorAll('[data-tilt]').forEach((card) => {
    if (card.dataset.tiltBound === 'true') return;
    card.dataset.tiltBound = 'true';

    card.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = card.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;

      const rotateY = (relX - 0.5) * 9; // max ±4.5deg : subtil et premium
      const rotateX = (0.5 - relY) * 9;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
      card.style.setProperty('--glare-x', `${(relX * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(relY * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-opacity', '1');
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      card.style.setProperty('--glare-opacity', '0');
    });
  });
}

/* --------------------------------------------------------------------------
   4. ANIMATIONS GSAP + SCROLLTRIGGER & COMPTEURS ANIMÉS
   -------------------------------------------------------------------------- */
export function initMotionSystem() {
  const reduced = prefersReducedMotion();
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Compteurs numériques
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = Number.parseFloat(el.dataset.target || '0');
    const decimals = Number.parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';

    const formatVal = (val) => {
      const fixed = val.toFixed(decimals);
      const [intPart, decPart] = fixed.split('.');
      const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return `${prefix}${decPart ? `${spacedInt},${decPart}` : spacedInt}${suffix}`;
    };

    if (reduced || !gsap) {
      el.textContent = formatVal(target);
      return;
    }

    const counterObj = { val: 0 };
    gsap.to(counterObj, {
      val: target,
      duration: 1.6,
      ease: 'power3.out',
      scrollTrigger: ScrollTrigger
        ? {
            trigger: el,
            start: 'top 90%',
            once: true,
          }
        : undefined,
      onUpdate() {
        el.textContent = formatVal(counterObj.val);
      },
    });
  });

  if (reduced || !gsap) {
    document.querySelectorAll('[data-hero-item], [data-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  // Entrée chorégraphiée du Hero
  const heroItems = document.querySelectorAll('[data-hero-item]');
  if (heroItems.length > 0) {
    gsap.fromTo(
      heroItems,
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.72,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform',
      }
    );
  }

  // Textes et sections révélés au scroll
  document.querySelectorAll('[data-reveal]').forEach((section) => {
    gsap.fromTo(
      section,
      { opacity: 0, y: 26 },
      {
        opacity: 1,
        y: 0,
        duration: 0.68,
        ease: 'power2.out',
        clearProps: 'transform',
        scrollTrigger: ScrollTrigger
          ? {
              trigger: section,
              start: 'top 88%',
              once: true,
            }
          : undefined,
      }
    );
  });

  // Ligne de progression verticale au scroll (section moteur d'acquisition)
  const scrollLine = document.querySelector('[data-scroll-line]');
  if (scrollLine && ScrollTrigger) {
    gsap.fromTo(
      scrollLine,
      { scaleY: 0, transformOrigin: 'top center' },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: scrollLine.parentElement,
          start: 'top 75%',
          end: 'bottom 65%',
          scrub: 0.4,
        },
      }
    );
  }

  bindTiltCards();
}

/* --------------------------------------------------------------------------
   5. TRANSITIONS DE PAGE FLUIDES (RESPECTANT PREFERS-REDUCED-MOTION & BFCACHE)
   -------------------------------------------------------------------------- */
export function initPageTransitions() {
  if (!document.getElementById('page-transition-veil')) {
    const veil = document.createElement('div');
    veil.id = 'page-transition-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
  }

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('is-transitioning');
  });

  document.addEventListener('click', (event) => {
    if (prefersReducedMotion()) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;

    const rawHref = anchor.getAttribute('href') || '';
    if (
      !rawHref ||
      rawHref.startsWith('#') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:') ||
      rawHref.startsWith('http://') ||
      rawHref.startsWith('https://')
    ) {
      return;
    }

    event.preventDefault();
    document.body.classList.add('is-transitioning');
    window.setTimeout(() => {
      window.location.href = anchor.href;
    }, 160);
  });
}

/* --------------------------------------------------------------------------
   6. BOOTSTRAP COMMUN À TOUTES LES PAGES
   -------------------------------------------------------------------------- */
export function bootStorefrontPage(activePage = '') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if ((localStorage.getItem('valence_theme') || 'system') === 'system') {
      applyThemeFromPreference();
    }
  });

  renderSharedChrome(activePage);
  initPageTransitions();
  initMotionSystem();
  storeApi.recordPageVisit();
}
