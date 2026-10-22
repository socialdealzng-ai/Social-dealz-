// Public, read-only catalogue endpoints.
const express = require('express');
const { HttpError } = require('../middleware/errors');
const { listQuerySchema, slugParamSchema } = require('../validation/catalogue');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseOrThrow(schema, input, message) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.') || 'value', message: i.message }));
    throw new HttpError(400, 'invalid_request', message, details);
  }
  return result.data;
}

function catalogueRouter(catalogue) {
  const router = express.Router();

  router.get(
    '/categories',
    wrap(async (req, res) => {
      res.json({ items: await catalogue.listCategories() });
    })
  );

  router.get(
    '/products',
    wrap(async (req, res) => {
      // Treat "?q=" (empty) the same as not sending the option at all.
      const cleaned = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ''));
      const f = parseOrThrow(listQuerySchema, cleaned, 'Some search options are not valid.');

      const result = await catalogue.listProducts({
        q: f.q,
        category: f.category,
        availability: f.availability,
        minPriceMinor: f.minPrice === undefined ? undefined : f.minPrice * 100,
        maxPriceMinor: f.maxPrice === undefined ? undefined : f.maxPrice * 100,
        sort: f.sort,
        limit: f.pageSize,
        offset: (f.page - 1) * f.pageSize,
      });

      res.json({ items: result.items, total: result.total, page: f.page, pageSize: f.pageSize });
    })
  );

  router.get(
    '/products/:slug',
    wrap(async (req, res) => {
      const slug = parseOrThrow(slugParamSchema, req.params.slug, 'That product link is not valid.');
      const product = await catalogue.getProductBySlug(slug);
      if (!product) throw new HttpError(404, 'not_found', 'That listing was not found.');
      res.json({ item: product });
    })
  );

  return router;
}

module.exports = { catalogueRouter };
                                                            
