-- =============================================================
-- TABLO — Database schema
-- Paste this whole file into Supabase SQL editor and run it.
-- =============================================================

-- Enable UUIDs
create extension if not exists "uuid-ossp";

-- ---------- Restaurants (tenants) ----------
create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,                   -- e.g. "sahiba" → /r/sahiba/t/7
  name text not null,
  tagline text,
  logo_url text,
  cover_url text,
  address text,
  phone text,
  currency text default 'INR',
  tax_rate numeric(5,2) default 5.00,         -- GST %
  owner_email text,
  created_at timestamptz default now()
);

-- ---------- Tables ----------
create table if not exists restaurant_tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  number int not null,
  capacity int default 2,
  qr_token text unique not null,              -- random token, used in QR URL
  created_at timestamptz default now(),
  unique (restaurant_id, number)
);

-- ---------- Menu categories ----------
create table if not exists menu_categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,                          -- "Appetizers", "Mains", "Desserts"
  sort_order int default 0
);

-- ---------- Menu items ----------
create table if not exists menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  is_veg boolean default false,
  is_chef_pick boolean default false,
  is_available boolean default true,
  allergens text[],                            -- ['nuts','dairy','gluten']
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ---------- Orders ----------
create type order_status as enum ('received', 'preparing', 'ready', 'served', 'paid', 'cancelled');

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  table_id uuid references restaurant_tables(id) on delete set null,
  table_number int,                            -- denormalized for kitchen display
  status order_status default 'received',
  subtotal numeric(10,2) not null,
  tax numeric(10,2) not null,
  total numeric(10,2) not null,
  notes text,
  guest_name text,
  guest_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Order items ----------
create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,                         -- snapshot at time of order
  price numeric(10,2) not null,
  qty int not null,
  notes text,
  created_at timestamptz default now()
);

-- ---------- Indexes ----------
create index if not exists idx_orders_restaurant_status on orders(restaurant_id, status);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id);
create index if not exists idx_tables_token on restaurant_tables(qr_token);

-- ---------- Updated_at trigger ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

-- ---------- Realtime ----------
-- Enable realtime so the kitchen screen + guest order-status update live.
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

-- ---------- Row Level Security ----------
-- For MVP we keep RLS permissive on read paths (the guest needs to see the menu)
-- and require service role for writes from the server.
alter table restaurants enable row level security;
alter table restaurant_tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Public read of restaurants/tables/menu (anyone with the QR can browse)
create policy "public read restaurants" on restaurants for select using (true);
create policy "public read tables" on restaurant_tables for select using (true);
create policy "public read categories" on menu_categories for select using (true);
create policy "public read available menu" on menu_items for select using (is_available = true);

-- Orders: guests can read their own order by id (we pass order id back to the client)
create policy "public read orders" on orders for select using (true);
create policy "public read order items" on order_items for select using (true);

-- Writes: only service role (server) can insert/update — handled in API routes.
-- (No public insert/update policies, so anon client can't write directly.)
