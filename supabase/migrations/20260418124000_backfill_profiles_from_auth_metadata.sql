insert into public.profiles (
  id,
  username,
  full_name,
  profile_photo_url,
  role,
  discipline,
  art_types,
  country,
  city,
  experience,
  bio,
  instagram,
  spotify_url,
  facebook,
  website,
  is_available,
  collective_type,
  member_count
)
select
  users.id,
  nullif(trim(users.raw_user_meta_data ->> 'username'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'profile_photo_url'), ''),
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'role'), ''), 'ARTIST'),
  nullif(trim(users.raw_user_meta_data ->> 'discipline'), ''),
  case
    when jsonb_typeof(users.raw_user_meta_data -> 'art_types') = 'array' then
      array(select jsonb_array_elements_text(users.raw_user_meta_data -> 'art_types'))
    else
      '{}'::text[]
  end,
  nullif(trim(users.raw_user_meta_data ->> 'country'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'city'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'experience'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'bio'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'instagram'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'spotify_url'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'facebook'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'website'), ''),
  coalesce((users.raw_user_meta_data ->> 'is_available')::boolean, false),
  nullif(trim(users.raw_user_meta_data ->> 'collective_type'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'member_count'), '')::integer
from auth.users as users
left join public.profiles on profiles.id = users.id
where profiles.id is null;
