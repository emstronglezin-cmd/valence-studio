import { env } from '../config/env.js';

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const seoRenderService = {
  renderArticleHtml(article, { siteBaseUrl = env.frontendPublicUrl } = {}) {
    const canonicalUrl = `${siteBaseUrl}/articles/${encodeURIComponent(article.slug)}.html`;
    const publishedIso = article.published_at || new Date().toISOString();
    const faqItems = Array.isArray(article.faq_items) ? article.faq_items : [];
    const keywords = Array.isArray(article.keywords) ? article.keywords.join(', ') : '';

    const structuredData = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.meta_description,
        datePublished: publishedIso,
        dateModified: publishedIso,
        author: {
          '@type': 'Organization',
          name: 'Valence Studio',
          url: siteBaseUrl,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Valence Studio',
          url: siteBaseUrl,
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteBaseUrl}/index.html` },
          { '@type': 'ListItem', position: 2, name: 'Journal SEO', item: `${siteBaseUrl}/blog.html` },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl },
        ],
      },
    ];

    if (faqItems.length > 0) {
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      });
    }

    const faqHtml =
      faqItems.length > 0
        ? `<section class="mt-12 pt-8 border-t border-black/10 dark:border-white/10">
            <h2 class="text-xl font-bold mb-6">Questions fréquentes</h2>
            <div class="space-y-4">
              ${faqItems
                .map(
                  (f) => `<div class="p-5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10">
                    <h3 class="font-semibold mb-2">${escapeXml(f.question)}</h3>
                    <p class="text-sm opacity-80 leading-relaxed">${escapeXml(f.answer)}</p>
                  </div>`
                )
                .join('')}
            </div>
          </section>`
        : '';

    return `<!DOCTYPE html>
<html lang="fr" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeXml(article.meta_title || article.title)} — Valence Studio</title>
  <meta name="description" content="${escapeXml(article.meta_description)}" />
  ${keywords ? `<meta name="keywords" content="${escapeXml(keywords)}" />` : ''}
  <link rel="canonical" href="${escapeXml(canonicalUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeXml(article.meta_title || article.title)}" />
  <meta property="og:description" content="${escapeXml(article.meta_description)}" />
  <meta property="og:url" content="${escapeXml(canonicalUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'media' };
  </script>
</head>
<body class="bg-[#F7F6F2] text-[#111215] dark:bg-[#090A0D] dark:text-[#F3F4F6] antialiased selection:bg-[#2546F0] selection:text-white">
  <header class="border-b border-black/10 dark:border-white/10 backdrop-blur-md sticky top-0 z-30 bg-[#F7F6F2]/90 dark:bg-[#090A0D]/90">
    <div class="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
      <a href="${escapeXml(siteBaseUrl)}/index.html" class="font-bold tracking-widest text-xs uppercase">Valence Studio</a>
      <nav class="flex items-center gap-6 text-sm">
        <a href="${escapeXml(siteBaseUrl)}/blog.html" class="opacity-75 hover:opacity-100">Journal</a>
        <a href="${escapeXml(siteBaseUrl)}/catalogue.html" class="opacity-75 hover:opacity-100">Catalogue</a>
        <a href="${escapeXml(siteBaseUrl)}/ressource-gratuite.html" class="px-3.5 py-1.5 rounded-lg bg-[#2546F0] text-white font-medium text-xs">Extrait gratuit</a>
      </nav>
    </div>
  </header>

  <main class="max-w-3xl mx-auto px-6 py-16">
    <div class="text-xs font-mono uppercase tracking-widest text-[#2546F0] dark:text-[#5B78FF] mb-4">
      Journal d'Acquisition B2B • ${escapeXml(String(article.reading_time_minutes || 5))} min de lecture
    </div>
    <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-6">${escapeXml(article.title)}</h1>
    <p class="text-lg opacity-75 leading-relaxed mb-10 pb-8 border-b border-black/10 dark:border-white/10">
      ${escapeXml(article.meta_description)}
    </p>

    <article class="prose prose-neutral dark:prose-invert max-w-none space-y-5 leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2">
      ${article.content_html}
    </article>

    ${faqHtml}

    <aside class="mt-14 p-8 rounded-2xl bg-[#111215] text-white dark:bg-[#151923] border border-white/10">
      <div class="text-xs font-mono uppercase tracking-widest text-[#5B78FF] mb-2">Ressource Opérationnelle Gratuite</div>
      <h2 class="text-2xl font-bold mb-3">Passez de la lecture à l'exécution en 15 minutes</h2>
      <p class="text-sm text-white/75 mb-6">Téléchargez gratuitement notre Kit d'Extraction (25 prompts calibrés, SOP Notion et échantillon d'annuaire B2B vérifié) ou explorez nos systèmes complets.</p>
      <div class="flex flex-wrap gap-3">
        <a href="${escapeXml(siteBaseUrl)}/ressource-gratuite.html" class="px-5 py-2.5 rounded-lg bg-[#2546F0] text-white font-semibold text-sm">Recevoir le Kit Gratuit</a>
        <a href="${escapeXml(siteBaseUrl)}/catalogue.html" class="px-5 py-2.5 rounded-lg bg-white/10 text-white font-semibold text-sm">Explorer le Catalogue</a>
      </div>
    </aside>
  </main>

  <footer class="border-t border-black/10 dark:border-white/10 py-10 text-center text-xs opacity-60">
    <p>&copy; ${new Date().getUTCFullYear()} Valence Studio — Produits numériques internationaux &bull; <a href="${escapeXml(siteBaseUrl)}/mentions-legales.html" class="underline">Mentions légales &amp; CGV</a></p>
  </footer>
</body>
</html>`;
  },

  renderSitemapXml({ articles = [], products = [], siteBaseUrl = env.frontendPublicUrl }) {
    const base = siteBaseUrl.replace(/\/+$/, '');
    const nowDate = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: `${base}/index.html`, priority: '1.0', changefreq: 'daily' },
      { loc: `${base}/catalogue.html`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${base}/ressource-gratuite.html`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${base}/blog.html`, priority: '0.8', changefreq: 'daily' },
      { loc: `${base}/mentions-legales.html`, priority: '0.4', changefreq: 'monthly' },
    ];

    const productUrls = products.map((p) => ({
      loc: `${base}/produit.html?slug=${encodeURIComponent(p.slug)}`,
      lastmod: (p.updated_at || p.created_at || nowDate).slice(0, 10),
      priority: '0.85',
      changefreq: 'weekly',
    }));

    const articleUrls = articles.map((a) => ({
      loc: `${base}/blog.html?slug=${encodeURIComponent(a.slug)}`,
      lastmod: (a.published_at || nowDate).slice(0, 10),
      priority: '0.8',
      changefreq: 'monthly',
    }));

    const allEntries = [...staticPages, ...productUrls, ...articleUrls];

    const urlBlocks = allEntries
      .map(
        (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod || nowDate)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks}
</urlset>`;
  },

  renderRobotsTxt({ siteBaseUrl = env.frontendPublicUrl, apiBaseUrl = env.backendPublicUrl } = {}) {
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin.html',
      'Disallow: /checkout.html',
      'Disallow: /merci.html',
      `Sitemap: ${siteBaseUrl.replace(/\/+$/, '')}/sitemap.xml`,
      `Sitemap: ${apiBaseUrl.replace(/\/+$/, '')}/sitemap.xml`,
      '',
    ].join('\n');
  },
};
