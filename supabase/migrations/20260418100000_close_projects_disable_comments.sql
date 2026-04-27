-- ============================================================
-- WOA Migration — Allow projects to close while staying visible
-- ============================================================

alter table public.projects
  add column if not exists is_closed boolean not null default false;

drop policy if exists "project_comments_insert" on public.project_comments;

create policy "project_comments_insert" on public.project_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects
      where id = project_id
        and is_closed = false
    )
  );
