import { Router } from 'express';
import { repository } from '../db/repository.js';
import { seoRenderService } from '../services/seoRenderService.js';

export const seoApiRouter = Router();
export const seoPublicRouter = Router();

seoApiRouter.get('/articles', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '30'), 10)));
    const articles = await repository.listSeoArticles({ limit });
    return res.json({ articles });
  } catch (err) {
    return next(err);
  }
});

seoApiRouter.get('/articles/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const article = await repository.getSeoArticleBySlug(slug);
    if (!article) {
      return res.status(404).json({ error: 'Article SEO introuvable.' });
    }
    return res.json({ article });
  } catch (err) {
    return next(err);
  }
});

seoPublicRouter.get('/seo/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').replace(/\.html$/i, '').trim().toLowerCase();
    const article = await repository.getSeoArticleBySlug(slug);
    if (!article) {
      return res.status(404).send('Article introuvable.');
    }
    const html = seoRenderService.renderArticleHtml(article);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
});

seoPublicRouter.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const [articles, products] = await Promise.all([
      repository.listSeoArticles({ limit: 500 }),
      repository.listProducts(),
    ]);
    const xml = seoRenderService.renderSitemapXml({ articles, products });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (err) {
    return next(err);
  }
});

seoPublicRouter.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(seoRenderService.renderRobotsTxt());
});
