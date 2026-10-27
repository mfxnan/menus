-- Run after public.menus contains the rows from the attached SQL export.
-- Rows are copied idempotently; the legacy source table is never changed.
do $$
begin
  if to_regclass('public.menus') is not null then
    execute $import_categories$
      insert into public.categories (name, sort_order)
      select category_name, row_number() over (order by category_name) - 1
      from (
        select distinct coalesce(nullif(trim(row_data->>'display_category'), ''), nullif(trim(row_data->>'category'), '')) as category_name
        from (select to_jsonb(menu_row) as row_data from public.menus as menu_row) as source_rows
      ) as names
      where category_name is not null and length(category_name) <= 80
      on conflict (name) do nothing
    $import_categories$;

    execute $import_products$
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
        on category.name = coalesce(nullif(trim(row_data->>'display_category'), ''), nullif(trim(row_data->>'category'), ''))
      where nullif(row_data->>'id', '') is not null
      on conflict (id) do nothing
    $import_products$;
  end if;
end;
$$;
