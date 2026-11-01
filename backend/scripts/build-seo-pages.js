import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repository } from '../src/db/repository.js';
import { seoRenderService } from '../src/services/seoRenderService.js';
import { env } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '../../frontend');
const articlesOutDir = path.join(frontendDir, 'articles');

async function main() {
  await fs.mkdir(articlesOutDir, { recursive: true });

  const [articles, products] = await Promise.all([
    repository.listSeoArticles({ limit: 500 }),
    repository.listProducts(),
  ]);

  for (const article of articles) {
    const html = seoRenderService.renderArticleHtml(article, {
      siteBaseUrl: env.frontendPublicUrl,
    });
    const outPath = path.join(articlesOutDir, `${article.slug}.html`);
    await fs.writeFile(outPath, html, 'utf8');
  }

  const sitemapXml = seoRenderService.renderSitemapXml({
    articles,
    products,
    siteBaseUrl: env.frontendPublicUrl,
  });
  await fs.writeFile(path.join(frontendDir, 'sitemap.xml'), sitemapXml, 'utf8');

  const robotsTxt = seoRenderService.renderRobotsTxt({
    siteBaseUrl: env.frontendPublicUrl,
    apiBaseUrl: env.backendPublicUrl,
  });
  await fs.writeFile(path.join(frontendDir, 'robots.txt'), robotsTxt, 'utf8');

  console.info(
    `[SEO Statique] ${articles.length} articles HTML générés dans frontend/articles/ + sitemap.xml mis à jour.`
  );
}

main().catch((err) => {
  console.error('Erreur lors de la génération SEO statique :', err.message);
  process.exit(1);
});
