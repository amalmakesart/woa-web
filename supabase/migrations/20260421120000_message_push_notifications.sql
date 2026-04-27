-- WOA Migration — Push notifications for direct messages
-- Creates in-app notification rows for new messages and sends Expo push
-- notifications from Postgres using pg_net.

create extension if not exists pg_net;

create or replace function public.woa_message_notification_body(notification_row public.notifications)
returns text
language plpgsql
stable
as $$
declare
  actor_name text;
begin
  if notification_row.type = 'new_message' then
    select coalesce(nullif(username, ''), nullif(full_name, ''), 'Someone')
      into actor_name
    from public.profiles
    where id = notification_row.actor_id;

    return coalesce('@' || upper(actor_name) || ': ', 'New message: ')
      || coalesce(nullif(notification_row.preview_text, ''), 'You have a new message');
  end if;

  return coalesce(nullif(notification_row.preview_text, ''), 'You have a new notification');
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

  push_body := public.woa_message_notification_body(new);

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

create or replace function public.woa_create_notification_for_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  convo public.conversations%rowtype;
  recipient_id uuid;
begin
  select *
    into convo
  from public.conversations
  where id = new.conversation_id;

  if not found then
    return new;
  end if;

  if new.sender_id = convo.gig_poster_id then
    recipient_id := convo.artist_id;

    update public.conversations
    set
      last_message = new.content,
      last_message_at = new.created_at,
      artist_unread = coalesce(artist_unread, 0) + 1
    where id = new.conversation_id;
  elsif new.sender_id = convo.artist_id then
    recipient_id := convo.gig_poster_id;

    update public.conversations
    set
      last_message = new.content,
      last_message_at = new.created_at,
      gig_poster_unread = coalesce(gig_poster_unread, 0) + 1
    where id = new.conversation_id;
  else
    return new;
  end if;

  if recipient_id is not null and recipient_id <> new.sender_id then
    insert into public.notifications (
      user_id,
      type,
      actor_id,
      reference_id,
      reference_type,
      preview_text
    )
    values (
      recipient_id,
      'new_message',
      new.sender_id,
      new.conversation_id,
      'message',
      left(new.content, 160)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists woa_messages_create_notification on public.messages;
create trigger woa_messages_create_notification
after insert on public.messages
for each row
execute function public.woa_create_notification_for_new_message();
