alter table public.store_settings
  add column if not exists branch_name text not null default 'KS Tubun Purwokerto'
  check (length(trim(branch_name)) between 1 and 120);

update public.store_settings
set store_name = 'Rocket Chicken',
    branch_name = 'KS Tubun Purwokerto'
where store_name = 'Rocket Chicken KS Tubun';
