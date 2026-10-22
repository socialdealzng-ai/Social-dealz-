-- 001: catalogue tables (categories, products).
-- Prices are stored in kobo (1 naira = 100 kobo) as whole numbers to avoid
-- floating-point rounding. price_minor may be NULL = "no price set yet".
-- Max value of a 32-bit integer is about 21.4 million naira.

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             SERIAL PRIMARY KEY,
  category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug           TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title          TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description    TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  price_minor    INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency       CHAR(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  availability   TEXT NOT NULL DEFAULT 'unconfirmed'
                 CHECK (availability IN ('available', 'sold_out', 'unconfirmed')),
  image_url      TEXT CHECK (image_url IS NULL OR image_url ~ '^https://'),
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  is_published   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_published_created_idx ON products (is_published, created_at DESC);

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
