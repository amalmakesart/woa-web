-- WOA Migration — polished notifications, shareable safety tools, moderation.

create extension if not exists pg_net;

create or replace function public.woa_notification_body(notification_row public.notifications)
returns text
language plpgsql
stable
as $$
declare
  actor_name text;
begin
  select coalesce(nullif(username, ''), nullif(full_name, ''), 'Someone')
    into actor_name
  from public.profiles
  where id = notification_row.actor_id;

  actor_name := coalesce('@' || upper(actor_name), 'Someone');

  case notification_row.type
    when 'new_message' then
      return actor_name || ': ' || coalesce(nullif(notification_row.preview_text, ''), 'You have a new message');
    when 'new_follower' then
      return actor_name || ' started following you';
    when 'post_liked' then
      return actor_name || ' liked your post';
    when 'post_comment' then
      return actor_name || ' commented: ' || coalesce(nullif(notification_row.preview_text, ''), 'Open WOA to read it');
    when 'gig_interest' then
      return actor_name || ' expressed interest in your gig'
        || case when nullif(notification_row.preview_text, '') is not null then ': ' || notification_row.preview_text else '' end;
    when 'project_comment' then
      return actor_name || ' commented on your collab: ' || coalesce(nullif(notification_row.preview_text, ''), 'Open WOA to read it');
    when 'co_post_invite' then
      return actor_name || ' co-posted with you';
    when 'gig_nearby' then
      return 'New gig near you'
        || case when nullif(notification_row.preview_text, '') is not null then ': ' || notification_row.preview_text else '' end;
    when 'booking_confirmed' then
      return actor_name || ' confirmed a booking'
        || case when nullif(notification_row.preview_text, '') is not null then ': ' || notification_row.preview_text else '' end;
    else
      return coalesce(nullif(notification_row.preview_text, ''), 'You have a new notification');
  end case;
end;
$$;

create or replace function public.woa_send_expo_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  target_push_token text;
  push_body text;
begin
  select push_token
    into target_push_token
  from public.profiles
  where id = new.user_id;

  if target_push_token is null or target_push_token not like 'ExponentPushToken%' then
    return new;
  end if;

  push_body := public.woa_notification_body(new);

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'to', target_push_token,
      'title', 'WORK(ER) OF ART',
      'body', push_body,
      'sound', 'default',
      'data', jsonb_build_object(
        'type', new.type,
        'reference_id', new.reference_id,
        'reference_type', new.reference_type,
        'actor_id', new.actor_id
      )
    ),
    timeout_milliseconds := 2000
  );

  return new;
end;
$$;

drop trigger if exists woa_notifications_send_expo_push on public.notifications;
create trigger woa_notifications_send_expo_push
after insert on public.notifications
for each row
execute function public.woa_send_expo_push_for_notification();

create or replace function public.woa_notify_booking_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gig_title text;
begin
  if new.booking_status = 'booked' and coalesce(old.booking_status, 'none') <> 'booked' then
    select title into gig_title from public.gigs where id = new.gig_id;

    if new.artist_id is not null and new.gig_poster_id is not null then
      insert into public.notifications (user_id, type, actor_id, reference_id, reference_type, preview_text, is_read)
      values (new.artist_id, 'booking_confirmed', new.gig_poster_id, coalesce(new.gig_id, new.id), 'gig', gig_title, false);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists woa_notify_booking_confirmed on public.conversations;
create trigger woa_notify_booking_confirmed
after update of booking_status on public.conversations
for each row
execute function public.woa_notify_booking_confirmed();

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own_or_admin" on public.blocks;
create policy "blocks_select_own_or_admin" on public.blocks
  for select using (auth.uid() = blocker_id or public.is_woa_admin());

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_own_or_admin" on public.blocks;
create policy "blocks_delete_own_or_admin" on public.blocks
  for delete using (auth.uid() = blocker_id or public.is_woa_admin());

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'gig', 'project', 'message', 'feature')),
  target_id uuid not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports_select_admin_or_own" on public.reports;
create policy "reports_select_admin_or_own" on public.reports
  for select using (public.is_woa_admin() or auth.uid() = reporter_id);

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin" on public.reports
  for update using (public.is_woa_admin()) with check (public.is_woa_admin());

drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin" on public.reports
  for delete using (public.is_woa_admin());
