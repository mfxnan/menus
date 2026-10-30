-- Read-only checks. Public tables must have RLS enabled unless a documented
-- exception is intentional; inspect public.menus carefully as a legacy table.

-- RLS status for every table and partition in public.
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  forcerowsecurity as rls_forced
from pg_tables
where schemaname = 'public'
order by tablename;

-- All policies on public tables and Storage objects.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as check_expression
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Any returned public table needs an RLS policy review before public access.
select
  n.nspname as schemaname,
  c.relname as tablename
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by c.relname;

-- Table privileges granted directly to the browser roles.
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated')
  and table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;
