-- WOA Migration — admin console policies for web moderation.

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update
  using (auth.uid() = user_id or public.is_woa_admin())
  with check (auth.uid() = user_id or public.is_woa_admin());

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects
  for delete
  using (auth.uid() = user_id or public.is_woa_admin());

do $$
begin
  if to_regclass('public.features') is not null then
    execute 'alter table public.features enable row level security';

    execute 'drop policy if exists "features_select" on public.features';
    execute 'create policy "features_select" on public.features for select using (true)';

    execute 'drop policy if exists "features_insert_admin" on public.features';
    execute 'create policy "features_insert_admin" on public.features for insert with check (public.is_woa_admin())';

    execute 'drop policy if exists "features_update_admin" on public.features';
    execute 'create policy "features_update_admin" on public.features for update using (public.is_woa_admin()) with check (public.is_woa_admin())';

    execute 'drop policy if exists "features_delete_admin" on public.features';
    execute 'create policy "features_delete_admin" on public.features for delete using (public.is_woa_admin())';
  end if;
end $$;
