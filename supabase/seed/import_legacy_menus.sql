-- Run manually after public.categories and public.products exist and
-- public.menus contains the legacy rows. This copies rows; it never deletes
-- or modifies the legacy source. Re-running is safe.
do $$
declare
  source_count bigint;
  imported_count bigint;
  row_record record;
  category_name text;
  row_id text;
begin
  if to_regclass('public.menus') is null then
    raise exception 'public.menus does not exist; load the legacy table and rows first.';
  end if;

  select count(*) into source_count from public.menus;

  for row_record in
    select to_jsonb(menu_row) as row_data from public.menus as menu_row
  loop
    category_name := coalesce(
      nullif(trim(row_record.row_data->>'display_category'), ''),
      nullif(trim(row_record.row_data->>'category'), '')
    );
    row_id := nullif(trim(row_record.row_data->>'id'), '');

    if category_name is not null and length(category_name) > 80 then
      raise notice 'Skipping legacy row with category longer than 80 characters (id: %).', coalesce(row_id, '<empty>');
    end if;
    if row_id is null then
      raise notice 'Skipping legacy row with an empty id (category: %).', coalesce(category_name, '<empty>');
    elsif row_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise notice 'Skipping legacy row with an invalid UUID id: %.', row_id;
    end if;
  end loop;

  insert into public.categories (name, sort_order)
  select names.category_name, min(names.sort_order)
  from (
    select
      coalesce(
        nullif(trim(row_data->>'display_category'), ''),
        nullif(trim(row_data->>'category'), '')
      ) as category_name,
      coalesce(nullif(row_data->>'sort_order', '')::integer, 0) as sort_order
    from (select to_jsonb(menu_row) as row_data from public.menus as menu_row) as source_rows
  ) as names
  where names.category_name is not null
    and length(names.category_name) <= 80
  group by names.category_name
  on conflict (name) do nothing;

  insert into public.products
    (id, name, description, price, category_id, image_url, is_available, is_published, sort_order, created_at, updated_at)
  select
    (row_data->>'id')::uuid,
    coalesce(nullif(trim(row_data->>'name'), ''), 'Produk'),
    coalesce(row_data->>'description', ''),
    coalesce(nullif(row_data->>'price', '')::bigint, 0),
    category.id,
    nullif(row_data->>'image_url', ''),
    coalesce(nullif(row_data->>'active', '')::boolean, true),
    coalesce(nullif(row_data->>'active', '')::boolean, true),
    coalesce(nullif(row_data->>'sort_order', '')::integer, 0),
    coalesce(nullif(row_data->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(row_data->>'updated_at', '')::timestamptz, now())
  from (select to_jsonb(menu_row) as row_data from public.menus as menu_row) as source_rows
  join public.categories as category
    on category.name = coalesce(
      nullif(trim(row_data->>'display_category'), ''),
      nullif(trim(row_data->>'category'), '')
    )
  where nullif(trim(row_data->>'id'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and length(coalesce(
      nullif(trim(row_data->>'display_category'), ''),
      nullif(trim(row_data->>'category'), '')
    )) <= 80
  on conflict (id) do nothing;

  select count(distinct row_data->>'id')
  into imported_count
  from (select to_jsonb(menu_row) as row_data from public.menus as menu_row) as source_rows
  join public.products as product on product.id::text = row_data->>'id'
  where nullif(trim(row_data->>'id'), '') is not null;

  raise notice 'Legacy import summary: % source rows; % unique legacy products are present after import.', source_count, imported_count;
end;
$$;
