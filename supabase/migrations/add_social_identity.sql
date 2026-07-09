-- ============================================================
-- Feature 09 · Slice 1 — Social identity
-- Adds username / display_name / avatar_url to profiles, guarantees a
-- profile row for every auth user, and exposes ONLY safe identity fields
-- through a public view. Diet / allergies / goals never leave `profiles`.
-- ============================================================

-- citext gives us case-insensitive unique handles (@Chef == @chef)
create extension if not exists citext;

alter table profiles
  add column if not exists username citext unique,
  add column if not exists display_name text,
  add column if not exists avatar_url text;

-- ── Auto-create a profile row on signup, seeding name + avatar from Google ──
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = coalesce(profiles.display_name, excluded.display_name),
    avatar_url   = coalesce(profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Backfill existing users who onboarded before identity existed ──
insert into profiles (id, display_name, avatar_url)
select id,
       raw_user_meta_data->>'full_name',
       raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do update set
  display_name = coalesce(profiles.display_name, excluded.display_name),
  avatar_url   = coalesce(profiles.avatar_url, excluded.avatar_url);

-- ── Public-safe identity view ──
-- security_invoker = false → runs with the view owner's rights, so it can read
-- the four safe columns of every profile without the base `profiles` self-only
-- SELECT policy leaking diet / allergies / goals.
drop view if exists public_profiles;
create view public_profiles
  with (security_invoker = false)
as
  select id, username, display_name, avatar_url
  from profiles
  where username is not null;

grant select on public_profiles to authenticated;

-- ── Email discovery: exact match only, at most one row, no enumeration ──
create or replace function find_user_by_email(lookup_email text)
returns table (id uuid, username citext, display_name text, avatar_url text)
language plpgsql security definer stable set search_path = public as $$
begin
  return query
    select p.id, p.username, p.display_name, p.avatar_url
    from auth.users u
    join profiles p on p.id = u.id
    where lower(u.email) = lower(lookup_email)
      and p.username is not null
    limit 1;
end;
$$;

grant execute on function find_user_by_email(text) to authenticated;
