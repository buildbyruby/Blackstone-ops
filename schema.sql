-- ============================================================
-- BLACKSTONE OPS — SUPABASE SCHEMA
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── SETTINGS ─────────────────────────────────────────────────
create table settings (
  id         uuid primary key default uuid_generate_v4(),
  key        text unique not null,
  value      text,
  updated_at timestamptz default now()
);

-- Seed the QR token and store status
insert into settings (key, value) values
  ('qr_token',      'bst_' || substr(md5(random()::text), 1, 16)),
  ('store_active',  'true'),
  ('store_name',    'Blackstone Reserve'),
  ('store_tagline', 'Premium selections, delivered to your door');

-- ── CATEGORIES ───────────────────────────────────────────────
create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text unique not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

insert into categories (name, sort_order) values
  ('Coffee', 1), ('Tea', 2), ('Food', 3), ('Pastry', 4), ('Drinks', 5);

-- ── PRODUCTS ─────────────────────────────────────────────────
create table products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  price       numeric(10,2) not null,
  stock       int not null default 0,
  emoji       text default '📦',
  image_url   text,
  category_id uuid references categories(id) on delete set null,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Seed sample products
insert into products (name, description, price, stock, emoji) values
  ('Flat White',             'Double ristretto, velvety microfoam.',         4.00, 60,  '☕'),
  ('Single Origin Espresso', 'Bold Ethiopian espresso. Notes of chocolate.', 4.50, 48,  '☕'),
  ('Cold Brew Reserve',      '24-hour cold brewed. Smooth, naturally sweet.',6.00, 24,  '🧊'),
  ('Matcha Ceremonial',      'Premium Uji matcha. Vibrant, umami-rich.',     5.50, 36,  '🍵'),
  ('Almond Croissant',       'Buttery flaky croissant, almond cream.',       3.80, 18,  '🥐'),
  ('Avocado Toast',          'Sourdough, avocado, microgreens, lemon.',      8.50, 15,  '🥑'),
  ('Berry Smoothie',         'Mixed berries, oat milk, chia seeds.',         7.00, 20,  '🫐'),
  ('Wagyu Burger',           '100g wagyu, aged cheddar, caramelised onion.', 18.00, 12, '🍔');

-- ── CUSTOMERS ────────────────────────────────────────────────
create table customers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  phone      text unique not null,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  scanned_at timestamptz default now(),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ── ORDERS ───────────────────────────────────────────────────
create table orders (
  id          uuid primary key default uuid_generate_v4(),
  order_ref   text unique not null,  -- e.g. ORD-001
  customer_id uuid references customers(id) on delete set null,
  location    text not null,
  notes       text,
  total       numeric(10,2) not null,
  status      text not null default 'new'
              check (status in ('new','confirmed','processing','out-for-delivery','delivered','cancelled')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-generate order_ref
create sequence order_seq start 100;

create or replace function generate_order_ref()
returns trigger as $$
begin
  new.order_ref := 'ORD-' || lpad(nextval('order_seq')::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_order_ref
  before insert on orders
  for each row execute function generate_order_ref();

-- ── ORDER ITEMS ───────────────────────────────────────────────
create table order_items (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,   -- snapshot of name at order time
  price      numeric(10,2) not null,
  quantity   int not null default 1
);

-- ── MESSAGES ─────────────────────────────────────────────────
create table messages (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  from_admin  boolean not null default false,
  body        text not null,
  order_id    uuid references orders(id) on delete set null, -- optional: link to order
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
create table notifications (
  id         uuid primary key default uuid_generate_v4(),
  type       text not null check (type in ('order','access','message','stock')),
  title      text not null,
  body       text,
  read       boolean default false,
  link       text,  -- e.g. /admin/orders, /admin/qr
  created_at timestamptz default now()
);

-- ── REALTIME ─────────────────────────────────────────────────
-- Enable realtime on tables that need live updates
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table customers;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Admin-only tables (all require auth)
alter table settings     enable row level security;
alter table products     enable row level security;
alter table customers    enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;
alter table messages     enable row level security;
alter table notifications enable row level security;
alter table categories   enable row level security;

-- Allow all for authenticated admin (you'll lock this down with Supabase Auth)
create policy "Admin full access" on settings      for all using (auth.role() = 'authenticated');
create policy "Admin full access" on products      for all using (auth.role() = 'authenticated');
create policy "Admin full access" on customers     for all using (auth.role() = 'authenticated');
create policy "Admin full access" on orders        for all using (auth.role() = 'authenticated');
create policy "Admin full access" on order_items   for all using (auth.role() = 'authenticated');
create policy "Admin full access" on messages      for all using (auth.role() = 'authenticated');
create policy "Admin full access" on notifications for all using (auth.role() = 'authenticated');
create policy "Admin full access" on categories    for all using (auth.role() = 'authenticated');

-- Public read for products (store customers can browse without auth)
create policy "Public read products"    on products    for select using (is_active = true);
create policy "Public read categories"  on categories  for select using (true);

-- Customers can insert themselves (gate registration)
create policy "Customer self register"  on customers   for insert with check (true);

-- Customers can insert orders (validated by QR token in API)
create policy "Customer place order"    on orders      for insert with check (true);
create policy "Customer add items"      on order_items for insert with check (true);

-- Customers can read their own order and messages
create policy "Customer read own order"    on orders    for select using (true);
create policy "Customer read own messages" on messages  for select using (true);
create policy "Customer send messages"     on messages  for insert with check (true);

-- ── FUNCTIONS ─────────────────────────────────────────────────
-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at   before update on orders   for each row execute function update_updated_at();
create trigger products_updated_at before update on products for each row execute function update_updated_at();

-- ── VIEWS ─────────────────────────────────────────────────────
-- Convenient order summary view
create view order_summary as
select
  o.id,
  o.order_ref,
  o.status,
  o.total,
  o.location,
  o.notes,
  o.created_at,
  c.name    as customer_name,
  c.phone   as customer_phone,
  json_agg(json_build_object(
    'name',     oi.name,
    'quantity', oi.quantity,
    'price',    oi.price
  )) as items
from orders o
left join customers c    on c.id = o.customer_id
left join order_items oi on oi.order_id = o.id
group by o.id, o.order_ref, o.status, o.total, o.location, o.notes, o.created_at, c.name, c.phone
order by o.created_at desc;
