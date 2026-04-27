-- Fix gig_interests RLS: column is artist_id (not user_id)
-- Also ensure suggested_fee and note columns exist (matching app schema)

alter table public.gig_interests enable row level security;

alter table public.gig_interests
  add column if not exists suggested_fee numeric,
  add column if not exists note text;

drop policy if exists "gig_interests_select_own" on public.gig_interests;
drop policy if exists "gig_interests_select_poster" on public.gig_interests;
drop policy if exists "gig_interests_insert_own" on public.gig_interests;
drop policy if exists "gig_interests_delete_own" on public.gig_interests;

-- Use artist_id (the actual column name in this table)
create policy "gig_interests_select_own" on public.gig_interests
  for select using (auth.uid() = artist_id);

create policy "gig_interests_select_poster" on public.gig_interests
  for select using (
    auth.uid() = (select poster_id from public.gigs where id = gig_id limit 1)
  );

create policy "gig_interests_insert_own" on public.gig_interests
  for insert with check (auth.uid() = artist_id);

create policy "gig_interests_delete_own" on public.gig_interests
  for delete using (auth.uid() = artist_id);
