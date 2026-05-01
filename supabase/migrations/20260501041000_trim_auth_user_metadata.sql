update auth.users as u
set raw_user_meta_data = jsonb_strip_nulls(
  jsonb_build_object(
    'username', coalesce(nullif(trim(p.username), ''), nullif(trim(u.raw_user_meta_data ->> 'username'), '')),
    'full_name', coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')),
    'role', coalesce(nullif(trim(p.role), ''), nullif(trim(u.raw_user_meta_data ->> 'role'), ''))
  )
)
from public.profiles as p
where p.id = u.id
  and coalesce(pg_column_size(u.raw_user_meta_data), 0) > 256;

update auth.users as u
set raw_user_meta_data = jsonb_strip_nulls(
  jsonb_build_object(
    'username', nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
    'full_name', nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    'role', nullif(trim(u.raw_user_meta_data ->> 'role'), '')
  )
)
where coalesce(pg_column_size(u.raw_user_meta_data), 0) > 256;
