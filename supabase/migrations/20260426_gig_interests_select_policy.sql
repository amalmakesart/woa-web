-- Allow users to read their own gig interest records
-- (fixes "express interest" not persisting across page loads on web)

alter table public.gig_interests enable row level security;

drop policy if exists "gig_interests_select_own" on public.gig_interests;
create policy "gig_interests_select_own" on public.gig_interests
  for select using (auth.uid() = artist_id);

drop policy if exists "gig_interests_select_poster" on public.gig_interests;
create policy "gig_interests_select_poster" on public.gig_interests
  for select using (
    auth.uid() = (select poster_id from public.gigs where id = gig_id limit 1)
  );

drop policy if exists "gig_interests_insert_own" on public.gig_interests;
create policy "gig_interests_insert_own" on public.gig_interests
  for insert with check (auth.uid() = artist_id);

drop policy if exists "gig_interests_delete_own" on public.gig_interests;
create policy "gig_interests_delete_own" on public.gig_interests
  for delete using (auth.uid() = artist_id);
