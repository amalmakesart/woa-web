-- WOA Migration — keep post like_count synced with the app's likes table.

create or replace function public.woa_increment_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set like_count = coalesce(like_count, 0) + 1
  where id = new.post_id;

  return new;
end;
$$;

create or replace function public.woa_decrement_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set like_count = greatest(coalesce(like_count, 0) - 1, 0)
  where id = old.post_id;

  return old;
end;
$$;

do $$
begin
  if to_regclass('public.likes') is not null then
    execute 'alter table public.likes enable row level security';

    execute 'drop policy if exists "likes_select" on public.likes';
    execute 'create policy "likes_select" on public.likes for select using (true)';

    execute 'drop policy if exists "likes_insert_own" on public.likes';
    execute 'create policy "likes_insert_own" on public.likes for insert with check (auth.uid() = user_id)';

    execute 'drop policy if exists "likes_delete_own_or_admin" on public.likes';
    execute 'create policy "likes_delete_own_or_admin" on public.likes for delete using (auth.uid() = user_id or public.is_woa_admin())';

    execute 'drop trigger if exists woa_likes_increment_count on public.likes';
    execute 'create trigger woa_likes_increment_count after insert on public.likes for each row execute function public.woa_increment_post_like_count()';

    execute 'drop trigger if exists woa_likes_decrement_count on public.likes';
    execute 'create trigger woa_likes_decrement_count after delete on public.likes for each row execute function public.woa_decrement_post_like_count()';
  end if;
end $$;

update public.posts p
set like_count = coalesce(counts.like_count, 0)
from (
  select post_id, count(*)::int as like_count
  from public.likes
  group by post_id
) counts
where p.id = counts.post_id;

update public.posts p
set like_count = 0
where not exists (
  select 1
  from public.likes l
  where l.post_id = p.id
);
