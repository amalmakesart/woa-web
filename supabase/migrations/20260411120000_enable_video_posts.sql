alter table public.posts
drop constraint if exists posts_type_check;

alter table public.posts
add constraint posts_type_check
check (type in ('text', 'image', 'audio', 'video'));
