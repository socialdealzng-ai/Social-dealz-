-- Clearly labelled PLACEHOLDER data. No price and no confirmed availability
-- is invented: price_minor is NULL and availability is 'unconfirmed'.
-- Remove all of it later with:  DELETE FROM products WHERE is_placeholder;

INSERT INTO categories (slug, name, sort_order) VALUES
  ('social-media-handles', 'Social media handles', 1),
  ('digital-services', 'Digital services', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (category_id, slug, title, description, price_minor, availability, is_placeholder)
SELECT c.id, v.slug, v.title, v.description, NULL::integer, 'unconfirmed'::text, TRUE
FROM (VALUES
  ('placeholder-handle-listing-1', 'PLACEHOLDER: Handle listing 1',
   'Placeholder entry. Replace it with a real listing before launch. No price or availability has been set.',
   'social-media-handles'),
  ('placeholder-handle-listing-2', 'PLACEHOLDER: Handle listing 2',
   'Placeholder entry. Replace it with a real listing before launch. No price or availability has been set.',
   'social-media-handles'),
  ('placeholder-service-listing-1', 'PLACEHOLDER: Service listing 1',
   'Placeholder entry. Replace it with a real service before launch. No price or availability has been set.',
   'digital-services'),
  ('placeholder-service-listing-2', 'PLACEHOLDER: Service listing 2',
   'Placeholder entry. Replace it with a real service before launch. No price or availability has been set.',
   'digital-services')
) AS v(slug, title, description, category_slug)
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;
