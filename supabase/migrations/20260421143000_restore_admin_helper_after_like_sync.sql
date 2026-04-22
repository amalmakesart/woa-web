-- WOA Migration — keep admin helper reliable after like-count policy replay.

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
