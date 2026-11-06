import { Router } from 'express';
import { repository } from '../db/repository.js';

export const productsRouter = Router();

productsRouter.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
    const products = await repository.listProducts({ category });
    return res.json({ products });
  } catch (err) {
    return next(err);
  }
});

productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const product = await repository.getProductBySlug(slug);
    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    return res.json({ product });
  } catch (err) {
    return next(err);
  }
});
