-- =============================================================
-- TABLO — Auth migration (run AFTER schema.sql)
-- Adds multi-tenant membership and tightens RLS so each owner
-- only sees their own restaurant's data.
-- =============================================================

-- ---------- Membership: links auth.users to restaurants ----------
create type restaurant_role as enum ('owner', 'manager', 'staff');

create table if not exists restaurant_members (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role restaurant_role default 'owner',
  created_at timestamptz default now(),
  unique (restaurant_id, user_id)
);

create index if not exists idx_members_user on restaurant_members(user_id);

-- Enable RLS
alter table restaurant_members enable row level security;

-- Members can read their own memberships
create policy "members read own" on restaurant_members
  for select using (user_id = auth.uid());

-- ---------- Helper: check if a user is a member of a restaurant ----------
create or replace function is_member_of(rid uuid)
returns boolean as $$
  select exists (
    select 1 from restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- ---------- Tighten RLS on restaurants ----------
-- Owners can update their own restaurant
drop policy if exists "owners update own" on restaurants;
create policy "owners update own" on restaurants
  for update using (is_member_of(id));

-- ---------- Tighten RLS on tables, categories, menu_items ----------
-- Owners can write to their own restaurant's resources
drop policy if exists "owners write tables" on restaurant_tables;
create policy "owners write tables" on restaurant_tables
  for all using (is_member_of(restaurant_id))
  with check (is_member_of(restaurant_id));

drop policy if exists "owners write categories" on menu_categories;
create policy "owners write categories" on menu_categories
  for all using (is_member_of(restaurant_id))
  with check (is_member_of(restaurant_id));

drop policy if exists "owners write menu" on menu_items;
create policy "owners write menu" on menu_items
  for all using (is_member_of(restaurant_id))
  with check (is_member_of(restaurant_id));

-- ---------- Orders: owners can read/update their restaurant's orders ----------
drop policy if exists "owners manage orders" on orders;
create policy "owners manage orders" on orders
  for all using (is_member_of(restaurant_id))
  with check (is_member_of(restaurant_id));

drop policy if exists "owners manage order items" on order_items;
create policy "owners manage order items" on order_items
  for all using (
    exists (select 1 from orders o where o.id = order_id and is_member_of(o.restaurant_id))
  );

-- ---------- Auto-create membership on signup ----------
-- For now, manual: after a user signs up, an admin runs
-- INSERT INTO restaurant_members (restaurant_id, user_id) VALUES (...);
-- v3 will add an invite flow.

-- ---------- Demo: link the first signed-up user to Sahiba ----------
-- After your first user signs up, run this query manually with their email:
--
--   INSERT INTO restaurant_members (restaurant_id, user_id, role)
--   SELECT '11111111-1111-1111-1111-111111111111', id, 'owner'
--   FROM auth.users WHERE email = 'YOUR-EMAIL-HERE';
