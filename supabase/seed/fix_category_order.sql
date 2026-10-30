-- Optional, explicit repair for categories previously assigned alphabetical
-- order by migration 202610230002. Review the result before running this update.
update public.categories as category
set sort_order = legacy.min_sort_order
from (
  select
    category_name,
    min(sort_order) as min_sort_order
  from (
    select
      coalesce(
        nullif(trim(row_data->>'display_category'), ''),
        nullif(trim(row_data->>'category'), '')
      ) as category_name,
      coalesce(nullif(row_data->>'sort_order', '')::integer, 0) as sort_order
    from (select to_jsonb(menu_row) as row_data from public.menus as menu_row) as source_rows
  ) as source_rows
  where category_name is not null
    and length(category_name) <= 80
  group by category_name
) as legacy
where category.name = legacy.category_name
  and category.sort_order is distinct from legacy.min_sort_order;
