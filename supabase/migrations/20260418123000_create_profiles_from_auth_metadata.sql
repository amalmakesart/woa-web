create or replace function public.create_profile_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'profile_photo_url'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'ARTIST'),
    nullif(trim(new.raw_user_meta_data ->> 'discipline'), ''),
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'art_types') = 'array' then
        array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'art_types'))
      else
        '{}'::text[]
    end,
    nullif(trim(new.raw_user_meta_data ->> 'country'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'city'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'experience'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'bio'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'instagram'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'spotify_url'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'facebook'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'website'), ''),
    coalesce((new.raw_user_meta_data ->> 'is_available')::boolean, false),
    nullif(trim(new.raw_user_meta_data ->> 'collective_type'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'member_count'), '')::integer
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.create_profile_from_auth_metadata();
