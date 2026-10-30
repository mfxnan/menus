drop policy if exists "product_images_public_read" on storage.objects;

create policy "product_images_admin_read" on storage.objects
for select to authenticated
using (bucket_id = 'product-images' and (select public.is_admin()));
