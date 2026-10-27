create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_unique unique (name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  price bigint not null check (price >= 0),
  category_id uuid not null references public.categories(id) on update cascade on delete restrict,
  image_path text,
  image_url text,
  is_available boolean not null default true,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_description_length check (length(description) <= 1000)
);

create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'Rocket Chicken' check (length(trim(store_name)) between 1 and 120),
  branch_name text not null default 'KS Tubun Purwokerto' check (length(trim(branch_name)) between 1 and 120),
  whatsapp_number text not null default '',
  contact_information text not null default '',
  address text not null default '',
  opening_hours text not null default '',
  takeaway_enabled boolean not null default true,
  delivery_enabled boolean not null default true,
  delivery_address_required boolean not null default true,
  delivery_fee bigint not null default 0 check (delivery_fee >= 0),
  customer_phone_required boolean not null default false,
  public_information text not null default '',
  updated_at timestamptz not null default now(),
  constraint store_settings_whatsapp_format check (whatsapp_number = '' or whatsapp_number ~ '^62[0-9]{8,13}$')
);

create index if not exists products_public_catalog_idx
  on public.products (category_id, sort_order, name)
  where is_published and archived_at is null;
create index if not exists products_admin_catalog_idx
  on public.products (sort_order, name);
create index if not exists categories_public_catalog_idx
  on public.categories (sort_order, name)
  where is_active and archived_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.store_settings to authenticated;
grant select on public.categories, public.products, public.store_settings to anon;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "profiles_read_self" on public.profiles;
create policy "profiles_read_self" on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage" on public.profiles
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
for select to anon, authenticated using (
  (is_active and archived_at is null) or (select public.is_admin())
);
drop policy if exists "categories_admin_manage" on public.categories;
create policy "categories_admin_manage" on public.categories
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
for select to anon, authenticated using (
  (
    is_published and archived_at is null
    and exists (
      select 1 from public.categories as category
      where category.id = products.category_id
        and category.is_active and category.archived_at is null
    )
  ) or (select public.is_admin())
);
drop policy if exists "products_admin_manage" on public.products;
create policy "products_admin_manage" on public.products
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "store_settings_public_read" on public.store_settings;
create policy "store_settings_public_read" on public.store_settings
for select to anon, authenticated using (true);
drop policy if exists "store_settings_admin_manage" on public.store_settings;
create policy "store_settings_admin_manage" on public.store_settings
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_admin()));
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
for update to authenticated using (bucket_id = 'product-images' and (select public.is_admin()))
with check (bucket_id = 'product-images' and (select public.is_admin()));
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
for delete to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories') then
      alter publication supabase_realtime add table public.categories;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
      alter publication supabase_realtime add table public.products;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_settings') then
      alter publication supabase_realtime add table public.store_settings;
    end if;
  end if;
end;
$$;
