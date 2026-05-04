-- =============================================================
-- TABLO — Demo seed data
-- Run this AFTER schema.sql to get a working demo restaurant.
-- =============================================================

-- Demo restaurant
insert into restaurants (id, slug, name, tagline, address, phone, owner_email)
values (
  '11111111-1111-1111-1111-111111111111',
  'sahiba',
  'Sahiba Fine Dining',
  'Modern Indian, masterfully plated.',
  '12 Marine Drive, Kochi',
  '+91 98470 00000',
  'owner@sahiba.example'
) on conflict (slug) do nothing;

-- Tables
insert into restaurant_tables (restaurant_id, number, capacity, qr_token) values
  ('11111111-1111-1111-1111-111111111111', 1, 2, 'tok_t1_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 2, 2, 'tok_t2_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 3, 4, 'tok_t3_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 4, 4, 'tok_t4_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 5, 4, 'tok_t5_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 6, 6, 'tok_t6_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 7, 2, 'tok_t7_sahiba'),
  ('11111111-1111-1111-1111-111111111111', 8, 2, 'tok_t8_sahiba')
on conflict do nothing;

-- Categories
insert into menu_categories (id, restaurant_id, name, sort_order) values
  ('22222222-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Appetizers', 1),
  ('22222222-0002-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mains', 2),
  ('22222222-0003-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Desserts', 3)
on conflict do nothing;

-- Menu items
insert into menu_items (restaurant_id, category_id, name, description, price, is_veg, is_chef_pick, allergens, sort_order) values
  ('11111111-1111-1111-1111-111111111111', '22222222-0001-0000-0000-000000000001', 'Burrata with heirloom tomato', 'Pugliese burrata, basil oil, aged balsamic', 680, true, true, ARRAY['dairy'], 1),
  ('11111111-1111-1111-1111-111111111111', '22222222-0001-0000-0000-000000000001', 'Tuna tartare', 'Yellowfin, avocado, ponzu, sesame crisp', 920, false, true, ARRAY['sesame'], 2),
  ('11111111-1111-1111-1111-111111111111', '22222222-0001-0000-0000-000000000001', 'Truffle arancini', 'Carnaroli rice, black truffle, parmesan', 540, true, false, ARRAY['dairy','gluten'], 3),
  ('11111111-1111-1111-1111-111111111111', '22222222-0002-0000-0000-000000000002', 'Lamb shank', 'Slow-braised, rosemary jus, parsnip purée', 1450, false, true, ARRAY['dairy'], 1),
  ('11111111-1111-1111-1111-111111111111', '22222222-0002-0000-0000-000000000002', 'Wild mushroom risotto', 'Porcini, morel, aged parmesan', 980, true, false, ARRAY['dairy'], 2),
  ('11111111-1111-1111-1111-111111111111', '22222222-0002-0000-0000-000000000002', 'Pan-seared seabass', 'Lemon butter, samphire, fennel', 1280, false, false, ARRAY['fish','dairy'], 3),
  ('11111111-1111-1111-1111-111111111111', '22222222-0003-0000-0000-000000000003', 'Dark chocolate fondant', 'Valrhona 70%, vanilla bean ice cream', 480, true, true, ARRAY['dairy','gluten','egg'], 1),
  ('11111111-1111-1111-1111-111111111111', '22222222-0003-0000-0000-000000000003', 'Tiramisu', 'Mascarpone, espresso, savoiardi', 420, true, false, ARRAY['dairy','gluten','egg'], 2);
