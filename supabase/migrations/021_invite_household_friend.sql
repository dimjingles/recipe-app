-- Let household members add an existing friend directly to their household.
-- Existing link invites remain for people who are not already PrepTable friends.

create or replace function invite_household_friend(p_household uuid, p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if p_friend is null then raise exception 'Friend is required'; end if;
  if me = p_friend then raise exception 'Cannot invite yourself'; end if;
  if not is_household_member(p_household) then raise exception 'Not a household member'; end if;
  if not are_friends(me, p_friend) then raise exception 'You can only add existing friends'; end if;
  if exists (select 1 from household_members where user_id = p_friend) then
    raise exception 'That friend is already in a household';
  end if;

  insert into household_members (household_id, user_id, role)
    values (p_household, p_friend, 'member')
    on conflict do nothing;
end;
$$;

grant execute on function invite_household_friend(uuid, uuid) to authenticated;
