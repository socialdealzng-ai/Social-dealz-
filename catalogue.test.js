// Stage 1 tests: catalogue API behaviour using a fake in-memory catalogue.
// These do NOT test the real SQL or a real PostgreSQL database.
// Run with:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');

const sampleProduct = {
  id: 1,
  slug: 'test-listing',
  title: 'Test listing',
  description: 'Used only inside tests.',
  priceMinor: null,
  currency: 'NGN',
  availability: 'unconfirmed',
  imageUrl: null,
  isPlaceholder: true,
  category: { slug: 'test-category', name: 'Test category' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

function fakeCatalogue() {
  const calls = [];
  return {
    calls,
    async listCategories() {
      return [{ slug: 'test-category', name: 'Test category', productCount: 1 }];
    },
    async listProducts(filters) {
      calls.push(filters);
      return { items: [sampleProduct], total: 1 };
    },
    async getProductBySlug(slug) {
      return slug === sampleProduct.slug ? sampleProduct : null;
    },
  };
}

async function withServer(fn, { pingDb = async () => {} } = {}) {
  const catalogue = fakeCatalogue();
  const app = createApp({ catalogue, pingDb });
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, catalogue);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /healthz returns ok without touching the database', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('GET /api/health reports 503 when the database is unreachable', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/api/health`);
      assert.equal(res.status, 503);
      assert.equal((await res.json()).database, 'unreachable');
    },
    { pingDb: async () => { throw new Error('connection refused'); } }
  );
});

test('GET /api/products returns items with default paging', async () => {
  await withServer(async (base, catalogue) => {
    const res = await fetch(`${base}/api/products`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.total, 1);
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 12);
    assert.equal(catalogue.calls[0].limit, 12);
    assert.equal(catalogue.calls[0].offset, 0);
    assert.equal(catalogue.calls[0].sort, 'newest');
  });
});

test('GET /api/products passes filters through and converts naira to kobo', async () => {
  await withServer(async (base, catalogue) => {
    const url = `${base}/api/products?q=%20test%20&category=test-category&availability=available&minPrice=100&maxPrice=500&sort=price_asc&page=3&pageSize=5`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const f = catalogue.calls[0];
    assert.equal(f.q, 'test');
    assert.equal(f.category, 'test-category');
    assert.equal(f.availability, 'available');
    assert.equal(f.minPriceMinor, 10000);
    assert.equal(f.maxPriceMinor, 50000);
    assert.equal(f.sort, 'price_asc');
    assert.equal(f.limit, 5);
    assert.equal(f.offset, 10);
  });
});

test('GET /api/products treats an empty q as no search', async () => {
  await withServer(async (base, catalogue) => {
    const res = await fetch(`${base}/api/products?q=`);
    assert.equal(res.status, 200);
    assert.equal(catalogue.calls[0].q, undefined);
  });
});

test('GET /api/products rejects invalid query values with 400', async () => {
  await withServer(async (base, catalogue) => {
    const bad = [
      'sort=random',
      'availability=maybe',
      'page=0',
      'pageSize=500',
      'minPrice=abc',
      'minPrice=500&maxPrice=100',
      'category=Bad%20Slug',
      `q=${'x'.repeat(101)}`,
    ];
    for (const query of bad) {
      const res = await fetch(`${base}/api/products?${query}`);
      assert.equal(res.status, 400, `expected 400 for ${query}`);
      assert.equal((await res.json()).error.code, 'invalid_request');
    }
    assert.equal(catalogue.calls.length, 0, 'invalid requests must never reach the repository');
  });
});

test('GET /api/products/:slug returns one item, 404 when missing, 400 when malformed', async () => {
  await withServer(async (base) => {
    const ok = await fetch(`${base}/api/products/test-listing`);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).item.slug, 'test-listing');

    const missing = await fetch(`${base}/api/products/does-not-exist`);
    assert.equal(missing.status, 404);

    const malformed = await fetch(`${base}/api/products/Not%20A%20Slug`);
    assert.equal(malformed.status, 400);
  });
});

test('GET /api/categories lists categories', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/categories`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).items[0].slug, 'test-category');
  });
});

test('unknown /api routes return a JSON 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'not_found');
  });
});

test('responses include security headers and hide the framework', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/categories`);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
    assert.ok(res.headers.get('ratelimit') || res.headers.get('ratelimit-policy'), 'rate-limit headers expected');
  });
});

test('the storefront page is served', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /SOCIAL DEALZ/);
  });
});
