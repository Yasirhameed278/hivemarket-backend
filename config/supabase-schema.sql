-- =====================================================================
-- HiveMarket — Supabase / Postgres Schema (Supabase Auth edition)
-- Run this in the Supabase SQL Editor (or via psql) once on a fresh project.
--
-- Auth note: passwords live in `auth.users` (managed by Supabase Auth).
-- The `users` table here is a **profile** table whose `id` matches the
-- corresponding `auth.users.id`. A trigger auto-creates a profile row
-- whenever someone signs up.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy text search

-- ─── Users (profile rows; no passwords) ──────────────────────────────
create table if not exists users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  email         text not null unique,
  role          text not null default 'user' check (role in ('user','admin')),
  avatar        text default '',
  phone         text default '',
  addresses     jsonb not null default '[]'::jsonb,
  wishlist      jsonb not null default '[]'::jsonb,   -- array of product uuids
  cart          jsonb not null default '[]'::jsonb,   -- [{ _id, product, quantity, variant }]
  is_active     boolean not null default true,
  last_login    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_users_email on users(lower(email));
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_is_active on users(is_active);
create index if not exists idx_users_created_at on users(created_at desc);

-- Auto-create a profile row whenever a new auth.users row appears.
-- Pulls name from raw_user_meta_data->>'name' if signUp passed it.
create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ─── Products ────────────────────────────────────────────────────────
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique,
  description       text not null,
  short_description text default '',
  price             numeric(12,2) not null check (price >= 0),
  compare_price     numeric(12,2) default 0,
  category          text not null,
  subcategory       text default '',
  brand             text default '',
  images            jsonb not null default '[]'::jsonb,
  thumbnail         text default '',
  stock             integer not null default 0,
  sku               text unique,
  variants          jsonb not null default '[]'::jsonb,
  tags              jsonb not null default '[]'::jsonb,
  reviews           jsonb not null default '[]'::jsonb,
  rating            numeric(3,2) not null default 0,
  num_reviews       integer not null default 0,
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  seo_title         text default '',
  seo_description   text default '',
  seo_keywords      jsonb not null default '[]'::jsonb,
  meta_image        text default '',
  view_count        integer not null default 0,
  sold_count        integer not null default 0,
  weight            numeric(10,2) default 0,
  dimensions        jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_products_is_active on products(is_active);
create index if not exists idx_products_category_price on products(category, price);
create index if not exists idx_products_is_featured on products(is_featured);
create index if not exists idx_products_created_at on products(created_at desc);
create index if not exists idx_products_sold_count on products(sold_count desc);
create index if not exists idx_products_view_count on products(view_count desc);
create index if not exists idx_products_rating on products(rating desc);
create index if not exists idx_products_name_trgm on products using gin (name gin_trgm_ops);
create index if not exists idx_products_brand_trgm on products using gin (brand gin_trgm_ops);
create index if not exists idx_products_slug on products(slug);

-- ─── Orders ──────────────────────────────────────────────────────────
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  order_number        text not null unique,
  items               jsonb not null default '[]'::jsonb,
  shipping_address    jsonb not null default '{}'::jsonb,
  payment_method      text not null default 'card',
  payment_result      jsonb default '{}'::jsonb,
  items_price         numeric(12,2) not null default 0,
  shipping_price      numeric(12,2) not null default 0,
  tax_price           numeric(12,2) not null default 0,
  total_price         numeric(12,2) not null default 0,
  coupon_code         text default '',
  discount            numeric(12,2) not null default 0,
  status              text not null default 'pending'
                        check (status in ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  is_paid             boolean not null default false,
  paid_at             timestamptz,
  is_delivered        boolean not null default false,
  delivered_at        timestamptz,
  tracking_number     text default '',
  tracking_history    jsonb not null default '[]'::jsonb,
  notes               text default '',
  estimated_delivery  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_is_paid on orders(is_paid);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_order_number on orders(order_number);

-- ─── updated_at trigger ──────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at  before update on users    for each row execute function set_updated_at();

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at  before update on orders   for each row execute function set_updated_at();

-- ─── Atomic stock adjustment helper (RPC) ────────────────────────────
create or replace function adjust_product_stock(p_id uuid, p_qty int, p_sold_delta int)
returns void as $$
  update products
     set stock      = greatest(0, stock + p_qty),
         sold_count = greatest(0, sold_count + p_sold_delta)
   where id = p_id;
$$ language sql;
