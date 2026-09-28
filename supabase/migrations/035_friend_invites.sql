-- Friend invite links: every profile gets a secret, resettable invite_token.
-- /invite/<token> stores it in an httpOnly cookie; when that visitor finishes
-- onboarding, POST /api/onboarding calls accept_friend_invite() so the new
-- account starts out as an accepted friend of the token's owner.
-- Additive and idempotent.

-- Volatile default → evaluated per existing row, so every profile gets a
-- distinct token. Profiles RLS is own-row only and public_profiles doesn't
-- expose the column, so the token never leaves its owner.
alter table profiles
  add column if not exists invite_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_invite_token_key on profiles (invite_token);

-- Who owns an invite token, for the onboarding banner — runs before the visitor
-- has an account. Only the public_profiles columns, only for the exact
-- (unguessable) token, and only for inviters with a handle.
create or replace function invite_inviter(p_token uuid)
returns table (id uuid, username citext, display_name text, avatar_url text)
language sql security definer stable set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.invite_token = p_token and p.username is not null
$$;
grant execute on function invite_inviter(uuid) to anon, authenticated;

create or replace function accept_friend_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me      uuid := auth.uid();
  v_inviter uuid;
begin
  if v_me is null or p_token is null then return null; end if;

  -- New accounts only (existing users send a normal request). A UX gate, not a
  -- security boundary: the own-row update policy lets a user flip this flag,
  -- and the token itself is the capability. Call before completeOnboarding().
  if exists (select 1 from profiles where id = v_me and onboarding_completed) then
    return null;
  end if;

  -- Handle-less users are invisible in public_profiles, so they can't invite.
  select p.id into v_inviter
  from profiles p
  where p.invite_token = p_token and p.username is not null;

  if v_inviter is null or v_inviter = v_me then return null; end if;

  insert into friendships (user_id_a, user_id_b, status, requested_by)
  values (least(v_me, v_inviter), greatest(v_me, v_inviter), 'accepted', v_inviter)
  on conflict (user_id_a, user_id_b) do update
    set status = 'accepted', updated_at = now()
    where friendships.status = 'pending';   -- a blocked pair stays blocked

  -- Only report the inviter if the pair actually ended up friends.
  return case when are_friends(v_me, v_inviter) then v_inviter end;
end;
$$;
revoke all on function accept_friend_invite(uuid) from public, anon;
grant execute on function accept_friend_invite(uuid) to authenticated;
