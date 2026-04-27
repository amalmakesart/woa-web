drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert
  with check (
    auth.uid() = user_id
    and (select role from public.profiles where id = auth.uid()) in ('ARTIST', 'COLLECTIVE')
  );

drop policy if exists "project_comments_insert" on public.project_comments;
create policy "project_comments_insert" on public.project_comments
  for insert
  with check (
    auth.uid() = user_id
    and (select role from public.profiles where id = auth.uid()) in ('ARTIST', 'COLLECTIVE')
  );
