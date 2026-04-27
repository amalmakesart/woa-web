-- WOA Migration — Restore current admin helper after migration history repair
-- The older 20260411 admin migration can downgrade this helper if replayed.

create or replace function public.is_woa_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(coalesce(email, '')) = 'amalmakesart@gmail.com'
  )
$$;
