-- Use only if your Supabase project does not already have public.menus.
-- This staging table matches the columns in the attached menus_rows (1).sql.
create table if not exists public.menus (
  id uuid primary key,
  category text not null,
  display_category text not null,
  name text not null,
  description text not null default '',
  price bigint not null check (price >= 0),
  search_terms text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  image_url text
);

alter table public.menus enable row level security;
