-- ============================================================
-- WOA Migration — Server-side admin permissions
-- Gives amalmakesart@gmail.com real database-level control
-- over core site content while preserving normal owner rules.
-- ============================================================

create or replace function public.is_woa_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'amalmakesart@gmail.com'
$$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.gigs enable row level security;

drop policy if exists "woa_profiles_select" on public.profiles;
create policy "woa_profiles_select"
on public.profiles
for select
using (true);

drop policy if exists "woa_profiles_insert_owner_or_admin" on public.profiles;
create policy "woa_profiles_insert_owner_or_admin"
on public.profiles
for insert
with check (
  auth.uid() = id
  or public.is_woa_admin()
);

drop policy if exists "woa_profiles_update_owner_or_admin" on public.profiles;
create policy "woa_profiles_update_owner_or_admin"
on public.profiles
for update
using (
  auth.uid() = id
  or public.is_woa_admin()
)
with check (
  auth.uid() = id
  or public.is_woa_admin()
);

drop policy if exists "woa_profiles_delete_owner_or_admin" on public.profiles;
create policy "woa_profiles_delete_owner_or_admin"
on public.profiles
for delete
using (
  auth.uid() = id
  or public.is_woa_admin()
);

drop policy if exists "woa_posts_select" on public.posts;
create policy "woa_posts_select"
on public.posts
for select
using (true);

drop policy if exists "woa_posts_insert_owner_or_admin" on public.posts;
create policy "woa_posts_insert_owner_or_admin"
on public.posts
for insert
with check (
  auth.uid() = user_id
  or public.is_woa_admin()
);

drop policy if exists "woa_posts_update_owner_or_admin" on public.posts;
create policy "woa_posts_update_owner_or_admin"
on public.posts
for update
using (
  auth.uid() = user_id
  or public.is_woa_admin()
)
with check (
  auth.uid() = user_id
  or public.is_woa_admin()
);

drop policy if exists "woa_posts_delete_owner_or_admin" on public.posts;
create policy "woa_posts_delete_owner_or_admin"
on public.posts
for delete
using (
  auth.uid() = user_id
  or public.is_woa_admin()
);

drop policy if exists "woa_gigs_select" on public.gigs;
create policy "woa_gigs_select"
on public.gigs
for select
using (true);

drop policy if exists "woa_gigs_insert_owner_or_admin" on public.gigs;
create policy "woa_gigs_insert_owner_or_admin"
on public.gigs
for insert
with check (
  auth.uid() = poster_id
  or public.is_woa_admin()
);

drop policy if exists "woa_gigs_update_owner_or_admin" on public.gigs;
create policy "woa_gigs_update_owner_or_admin"
on public.gigs
for update
using (
  auth.uid() = poster_id
  or public.is_woa_admin()
)
with check (
  auth.uid() = poster_id
  or public.is_woa_admin()
);

drop policy if exists "woa_gigs_delete_owner_or_admin" on public.gigs;
create policy "woa_gigs_delete_owner_or_admin"
on public.gigs
for delete
using (
  auth.uid() = poster_id
  or public.is_woa_admin()
);

drop policy if exists "woa_post_collaborators_insert_owner_or_admin" on public.post_collaborators;
create policy "woa_post_collaborators_insert_owner_or_admin"
on public.post_collaborators
for insert
with check (
  auth.uid() = (select user_id from public.posts where id = post_id)
  or public.is_woa_admin()
);

drop policy if exists "woa_post_collaborators_update_collaborator_or_admin" on public.post_collaborators;
create policy "woa_post_collaborators_update_collaborator_or_admin"
on public.post_collaborators
for update
using (
  auth.uid() = collaborator_id
  or public.is_woa_admin()
)
with check (
  auth.uid() = collaborator_id
  or public.is_woa_admin()
);

drop policy if exists "woa_post_collaborators_delete_owner_collaborator_or_admin" on public.post_collaborators;
create policy "woa_post_collaborators_delete_owner_collaborator_or_admin"
on public.post_collaborators
for delete
using (
  auth.uid() = (select user_id from public.posts where id = post_id)
  or auth.uid() = collaborator_id
  or public.is_woa_admin()
);

