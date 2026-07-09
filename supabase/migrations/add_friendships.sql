-- ============================================================
-- Feature 09 · Slice 2 — Social graph (friendships)
-- One canonical row per pair (user_id_a < user_id_b). All writes go
-- through SECURITY DEFINER RPCs; the anon client has no insert/update/delete
-- policy, so the state machine can't be bypassed.
-- ============================================================

create table if not exists friendships (
  user_id_a    uuid not null references auth.users on delete cascade,
  user_id_b    uuid not null references auth.users on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  requested_by uuid not null references auth.users,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)   -- canonical ordering: one row per pair
);

-- Fast lookup for "accepted friends of user X"
create index if not exists friendships_a_accepted_idx on friendships (user_id_a) where status = 'accepted';
create index if not exists friendships_b_accepted_idx on friendships (user_id_b) where status = 'accepted';

alter table friendships enable row level security;

-- Participants can read their own friendship rows (and pending requests to them).
drop policy if exists "friendship participants can select" on friendships;
create policy "friendship participants can select"
  on friendships for select
  using (auth.uid() = user_id_a or auth.uid() = user_id_b);

-- NOTE: intentionally no insert/update/delete policies — writes go through the
-- SECURITY DEFINER RPCs below.

-- ── Core primitive used by every visibility RLS policy ──
create or replace function are_friends(u1 uuid, u2 uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and user_id_a = least(u1, u2)
      and user_id_b = greatest(u1, u2)
  )
$$;
grant execute on function are_friends(uuid, uuid) to authenticated;

-- ── State-machine mutations ──
create or replace function send_friend_request(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a  uuid := least(me, target_id);
  b  uuid := greatest(me, target_id);
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if me = target_id then raise exception 'Cannot friend yourself'; end if;
  -- A blocked pair stays blocked; a pending/accepted pair is left as-is.
  insert into friendships (user_id_a, user_id_b, status, requested_by)
  values (a, b, 'pending', me)
  on conflict (user_id_a, user_id_b) do nothing;
end;
$$;
grant execute on function send_friend_request(uuid) to authenticated;

create or replace function respond_to_request(other_id uuid, do_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a  uuid := least(me, other_id);
  b  uuid := greatest(me, other_id);
begin
  if me is null then raise exception 'Not authenticated'; end if;
  update friendships set
    status = case when do_accept then 'accepted' else 'blocked' end,
    updated_at = now()
  where user_id_a = a and user_id_b = b
    and requested_by = other_id   -- only the recipient (non-requester) may respond
    and status = 'pending';
end;
$$;
grant execute on function respond_to_request(uuid, boolean) to authenticated;

create or replace function unfriend(other_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not authenticated'; end if;
  delete from friendships
  where user_id_a = least(me, other_id)
    and user_id_b = greatest(me, other_id)
    and (me = user_id_a or me = user_id_b);
end;
$$;
grant execute on function unfriend(uuid) to authenticated;
