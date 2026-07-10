-- ============================================================
-- Feature 09 · Slice 3 — Household library + per-person rankings
--
-- Household = COLLABORATIVE ownership: members read/edit the same
-- household-owned recipes & cookbooks, but each keeps their OWN rank per
-- recipe (recipe_rankings). This is distinct from friend visibility
-- (read-only discovery, slice 4).
--
-- Membership/household writes go through SECURITY DEFINER RPCs only.
-- is_household_member() is SECURITY DEFINER so RLS policies that reference
-- household_members don't recurse.
-- ============================================================

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

create table if not exists household_invites (
  token        uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users on delete cascade,
  created_at   timestamptz default now(),
  expires_at   timestamptz not null default (now() + interval '7 days')
);

alter table households        enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
-- household_invites intentionally has NO policies → reachable via RPC only.

create index if not exists household_members_user_id_idx on household_members (user_id);

-- ── Membership predicates (SECURITY DEFINER → no RLS recursion) ──
create or replace function is_household_member(hh uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from household_members where household_id = hh and user_id = auth.uid()
  )
$$;
grant execute on function is_household_member(uuid) to authenticated;

create or replace function same_household(u1 uuid, u2 uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from household_members hm1
    join household_members hm2 using (household_id)
    where hm1.user_id = u1 and hm2.user_id = u2
  )
$$;
grant execute on function same_household(uuid, uuid) to authenticated;

-- Members can read their own household + its member list.
drop policy if exists "Members can view their households" on households;
create policy "Members can view their households"
  on households for select using (is_household_member(id));

drop policy if exists "Members can view household members" on household_members;
create policy "Members can view household members"
  on household_members for select using (is_household_member(household_id));

-- ── Household lifecycle RPCs ──
create or replace function create_household(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hid uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from household_members where user_id = me) then
    raise exception 'You are already in a household';
  end if;
  insert into households (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Household'), me)
    returning id into hid;
  insert into household_members (household_id, user_id, role) values (hid, me, 'admin');
  return hid;
end;
$$;
grant execute on function create_household(text) to authenticated;

create or replace function create_household_invite(p_household uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tok uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if not is_household_member(p_household) then raise exception 'Not a household member'; end if;
  insert into household_invites (household_id, created_by)
    values (p_household, me) returning token into tok;
  return tok;
end;
$$;
grant execute on function create_household_invite(uuid) to authenticated;

create or replace function household_invite_info(p_token uuid)
returns table (household_id uuid, name text)
language sql security definer stable set search_path = public as $$
  select h.id, h.name
  from household_invites i
  join households h on h.id = i.household_id
  where i.token = p_token and i.expires_at > now()
$$;
grant execute on function household_invite_info(uuid) to authenticated;

create or replace function accept_household_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hid uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  select household_id into hid from household_invites where token = p_token and expires_at > now();
  if hid is null then raise exception 'Invalid or expired invite'; end if;
  if exists (select 1 from household_members where user_id = me) then
    raise exception 'You are already in a household';
  end if;
  insert into household_members (household_id, user_id, role)
    values (hid, me, 'member') on conflict do nothing;
  return hid;
end;
$$;
grant execute on function accept_household_invite(uuid) to authenticated;

create or replace function leave_household(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from household_members where household_id = p_household and user_id = auth.uid();
end;
$$;
grant execute on function leave_household(uuid) to authenticated;

-- ── Shared ownership fields ──
-- owner_scope='user' keeps today's personal model; 'household' means every
-- member of household_id reads (and may edit) the same recipe/cookbook.
alter table recipes
  add column if not exists owner_scope text not null default 'user'
    check (owner_scope in ('user', 'household')),
  add column if not exists household_id uuid references households(id) on delete cascade;

alter table cookbooks
  add column if not exists owner_scope text not null default 'user'
    check (owner_scope in ('user', 'household')),
  add column if not exists household_id uuid references households(id) on delete cascade;

create index if not exists recipes_household_id_idx   on recipes   (household_id);
create index if not exists cookbooks_household_id_idx on cookbooks (household_id);

-- ── Additive household read/edit policies (owner policies are unchanged) ──
-- Members may VIEW and EDIT shared recipes/cookbooks, but DELETE stays
-- owner-only so a partner can't wipe the shared library.
drop policy if exists "Household members can view household recipes" on recipes;
create policy "Household members can view household recipes"
  on recipes for select
  using (owner_scope = 'household' and household_id is not null and is_household_member(household_id));

drop policy if exists "Household members can edit household recipes" on recipes;
create policy "Household members can edit household recipes"
  on recipes for update
  using (owner_scope = 'household' and household_id is not null and is_household_member(household_id))
  with check (owner_scope = 'household' and household_id is not null and is_household_member(household_id));

drop policy if exists "Household members can view household cookbooks" on cookbooks;
create policy "Household members can view household cookbooks"
  on cookbooks for select
  using (owner_scope = 'household' and household_id is not null and is_household_member(household_id));

drop policy if exists "Household members can edit household cookbooks" on cookbooks;
create policy "Household members can edit household cookbooks"
  on cookbooks for update
  using (owner_scope = 'household' and household_id is not null and is_household_member(household_id))
  with check (owner_scope = 'household' and household_id is not null and is_household_member(household_id));

-- cookbook_recipes: members can manage entries of household cookbooks
drop policy if exists "Household cookbook recipes - select" on cookbook_recipes;
create policy "Household cookbook recipes - select"
  on cookbook_recipes for select using (
    exists (select 1 from cookbooks c
      where c.id = cookbook_recipes.cookbook_id
        and c.owner_scope = 'household' and c.household_id is not null
        and is_household_member(c.household_id))
  );
drop policy if exists "Household cookbook recipes - insert" on cookbook_recipes;
create policy "Household cookbook recipes - insert"
  on cookbook_recipes for insert with check (
    exists (select 1 from cookbooks c
      where c.id = cookbook_recipes.cookbook_id
        and c.owner_scope = 'household' and c.household_id is not null
        and is_household_member(c.household_id))
  );
drop policy if exists "Household cookbook recipes - delete" on cookbook_recipes;
create policy "Household cookbook recipes - delete"
  on cookbook_recipes for delete using (
    exists (select 1 from cookbooks c
      where c.id = cookbook_recipes.cookbook_id
        and c.owner_scope = 'household' and c.household_id is not null
        and is_household_member(c.household_id))
  );

-- ingredients: follow the household recipe for read + edit
drop policy if exists "Household recipe ingredients - select" on ingredients;
create policy "Household recipe ingredients - select"
  on ingredients for select using (
    exists (select 1 from recipes r
      where r.id = ingredients.recipe_id
        and r.owner_scope = 'household' and r.household_id is not null
        and is_household_member(r.household_id))
  );
drop policy if exists "Household recipe ingredients - insert" on ingredients;
create policy "Household recipe ingredients - insert"
  on ingredients for insert with check (
    exists (select 1 from recipes r
      where r.id = ingredients.recipe_id
        and r.owner_scope = 'household' and r.household_id is not null
        and is_household_member(r.household_id))
  );
drop policy if exists "Household recipe ingredients - update" on ingredients;
create policy "Household recipe ingredients - update"
  on ingredients for update using (
    exists (select 1 from recipes r
      where r.id = ingredients.recipe_id
        and r.owner_scope = 'household' and r.household_id is not null
        and is_household_member(r.household_id))
  );
drop policy if exists "Household recipe ingredients - delete" on ingredients;
create policy "Household recipe ingredients - delete"
  on ingredients for delete using (
    exists (select 1 from recipes r
      where r.id = ingredients.recipe_id
        and r.owner_scope = 'household' and r.household_id is not null
        and is_household_member(r.household_id))
  );

-- ── Per-person rankings ──
create table if not exists recipe_rankings (
  user_id    uuid not null references auth.users on delete cascade,
  recipe_id  uuid not null references recipes(id) on delete cascade,
  rank       integer not null,
  updated_at timestamptz default now(),
  primary key (user_id, recipe_id),
  unique (user_id, rank) deferrable initially deferred
);

alter table recipe_rankings enable row level security;

drop policy if exists "Users can manage own recipe rankings" on recipe_rankings;
create policy "Users can manage own recipe rankings"
  on recipe_rankings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Backfill existing recipes.rank into the owner's per-user ranking.
-- Target the PK explicitly: ON CONFLICT can't auto-pick an arbiter while the
-- deferrable unique(user_id, rank) constraint exists on the table.
insert into recipe_rankings (user_id, recipe_id, rank)
select user_id, id, rank from recipes where rank is not null
on conflict (user_id, recipe_id) do nothing;
