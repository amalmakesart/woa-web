alter table public.posts
  add column if not exists media_urls text[] not null default '{}'::text[];

update public.posts
set media_urls = array[media_url]
where media_url is not null
  and coalesce(array_length(media_urls, 1), 0) = 0;
