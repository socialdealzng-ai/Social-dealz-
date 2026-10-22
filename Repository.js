// All catalogue SQL lives here. Every value goes through a bound parameter ($1, $2...).
const { getPool } = require('../db');

// Sort options are looked up from this fixed map, never built from user text.
const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_minor ASC NULLS LAST, p.id ASC',
  price_desc: 'p.price_minor DESC NULLS LAST, p.id ASC',
};

const PRODUCT_COLUMNS = `
  p.id, p.slug, p.title, p.description, p.price_minor, p.currency, p.availability,
  p.image_url, p.is_placeholder, p.created_at,
  c.slug AS category_slug, c.name AS category_name`;

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

function toProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceMinor: row.price_minor, // kobo; null means "no price set"
    currency: row.currency,
    availability: row.availability,
    imageUrl: row.image_url,
    isPlaceholder: row.is_placeholder,
    category: { slug: row.category_slug, name: row.category_name },
    createdAt: row.created_at,
  };
}

function buildWhere(filters) {
  const where = ['p.is_published = TRUE'];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.q) {
    const ph = add(`%${escapeLike(filters.q)}%`);
    where.push(`(p.title ILIKE ${ph} OR p.description ILIKE ${ph})`);
  }
  if (filters.category) where.push(`c.slug = ${add(filters.category)}`);
  if (filters.availability) where.push(`p.availability = ${add(filters.availability)}`);
  if (filters.minPriceMinor !== undefined) where.push(`p.price_minor >= ${add(filters.minPriceMinor)}`);
  if (filters.maxPriceMinor !== undefined) where.push(`p.price_minor <= ${add(filters.maxPriceMinor)}`);

  return { clause: where.join(' AND '), params };
}

function createCatalogueRepository(poolProvider = getPool) {
  return {
    async listCategories() {
      const { rows } = await poolProvider().query(`
        SELECT c.slug, c.name, COUNT(p.id) FILTER (WHERE p.is_published) AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order, c.name`);
      return rows.map((r) => ({ slug: r.slug, name: r.name, productCount: Number(r.product_count) }));
    },

    async listProducts(filters) {
      const pool = poolProvider();
      const { clause, params } = buildWhere(filters);
      const orderBy = SORTS[filters.sort] || SORTS.newest;
      const from = `FROM products p JOIN categories c ON c.id = p.category_id WHERE ${clause}`;

      const countResult = await pool.query(`SELECT COUNT(*) AS total ${from}`, params);
      const listParams = [...params, filters.limit, filters.offset];
      const listResult = await pool.query(
        `SELECT ${PRODUCT_COLUMNS} ${from} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        listParams
      );
      return { items: listResult.rows.map(toProduct), total: Number(countResult.rows[0].total) };
    },

    async getProductBySlug(slug) {
      const { rows } = await poolProvider().query(
        `SELECT ${PRODUCT_COLUMNS}
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.slug = $1 AND p.is_published = TRUE`,
        [slug]
      );
      return rows[0] ? toProduct(rows[0]) : null;
    },
  };
}

module.exports = { createCatalogueRepository };
