create table if not exists public.feature_interests (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now() not null,
  constraint feature_interests_user_id_key unique (user_id)
);

alter table public.feature_interests enable row level security;

drop policy if exists "Users can insert their own interest" on public.feature_interests;
create policy "Users can insert their own interest"
  on public.feature_interests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own interest" on public.feature_interests;
create policy "Users can view their own interest"
  on public.feature_interests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all interests" on public.feature_interests;
create policy "Admins can view all interests"
  on public.feature_interests for select
  to authenticated
  using (public.is_woa_admin());
