-- WOA Migration — rebuild broken likes triggers.
-- A stale trigger on public.likes referenced a non-existent "body" column,
-- which caused app/web like inserts to fail and disappear after refresh.

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

create or replace function public.woa_notify_post_liked_from_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  post_title text;
  post_preview text;
begin
  select user_id, title, content
    into owner_id, post_title, post_preview
  from public.posts
  where id = new.post_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (
      user_id,
      type,
      actor_id,
      reference_id,
      reference_type,
      preview_text,
      is_read
    )
    values (
      owner_id,
      'post_liked',
      new.user_id,
      new.post_id,
      'post',
      coalesce(nullif(post_title, ''), left(coalesce(post_preview, ''), 80)),
      false
    );
  end if;

  return new;
end;
$$;

do $$
declare
  trigger_row record;
begin
  if to_regclass('public.likes') is null then
    return;
  end if;

  -- Remove stale/broken triggers first, including unknown historical names.
  for trigger_row in
    select tgname
    from pg_trigger
    where tgrelid = 'public.likes'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on public.likes', trigger_row.tgname);
  end loop;

  alter table public.likes enable row level security;

  drop policy if exists "likes_select" on public.likes;
  create policy "likes_select" on public.likes
    for select using (true);

  drop policy if exists "likes_insert_own" on public.likes;
  create policy "likes_insert_own" on public.likes
    for insert with check (auth.uid() = user_id);

  drop policy if exists "likes_delete_own_or_admin" on public.likes;
  create policy "likes_delete_own_or_admin" on public.likes
    for delete using (auth.uid() = user_id or public.is_woa_admin());

  create trigger woa_likes_increment_count
  after insert on public.likes
  for each row
  execute function public.woa_increment_post_like_count();

  create trigger woa_likes_decrement_count
  after delete on public.likes
  for each row
  execute function public.woa_decrement_post_like_count();

  create trigger woa_likes_notify_owner
  after insert on public.likes
  for each row
  execute function public.woa_notify_post_liked_from_likes();
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
