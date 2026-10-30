-- Find existing rows that would fail validation:
-- select id, image_url from public.products
-- where image_url is not null
--   and (image_url !~ '^https://' or length(image_url) > 2048);
--
-- After correcting all returned rows manually, validate separately:
-- alter table public.products validate constraint products_image_url_https;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_image_url_https'
  ) then
    alter table public.products
      add constraint products_image_url_https
      check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 2048))
      not valid;
  end if;
end;
$$;
