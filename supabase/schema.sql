-- ============================================================
-- Mise en Place — Supabase Schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- PROFILES (onboarding answers + first-run flag)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  household_size   text,        -- 'just_me' | 'couple' | 'family'
  cook_frequency   text,        -- '0-2' | '3-5' | '6+'
  referral_source  text,
  primary_goal     text,        -- 'healthier'|'save_time'|'save_money'|'learn'|'reduce_waste'
  diet             text,        -- 'balanced'|'whole_food'|'mediterranean'|'flexitarian'|'pescatarian'|'vegetarian'|'vegan'|'low_carb'
  allergies        text[] default '{}',
  favorite_cuisines text[] default '{}',
  skill_level      text,        -- 'beginner'|'getting_there'|'confident'|'pro'
  meal_reminders   boolean default false,
  skill_profile jsonb default '{}'::jsonb,
  recipe_sort_preference text not null default 'ranking' check (recipe_sort_preference in ('ranking', 'recently_cooked', 'most_cooked', 'cook_time')),
  recipe_sort_direction text not null default 'default' check (recipe_sort_direction in ('default', 'reversed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "own profile - select" on profiles for select using (auth.uid() = id);
create policy "own profile - insert" on profiles for insert with check (auth.uid() = id);
create policy "own profile - update" on profiles for update using (auth.uid() = id);

-- TECHNIQUES
create table if not exists techniques (
  key text primary key,
  label text not null,
  category text not null,
  description text not null,
  prerequisites text[] default '{}'
);

alter table techniques enable row level security;
create policy "techniques are public read" on techniques for select using (true);

-- RECIPES
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  cuisine text,
  cook_time_minutes integer,
  servings integer default 4,
  instructions text,
  instruction_steps jsonb,
  image_url text,
  gallery_images text[] default '{}',
  tags text[] default '{}',
  techniques text[] default '{}',
  cooked_count integer default 0,
  last_cooked_at timestamptz,
  rank integer,
  feedback text check (feedback in ('like', 'okay', 'dislike')),
  recipe_type text,
  -- AI Recipe Adaptation: link a variant back to the recipe it was adapted from.
  original_recipe_id uuid references recipes(id) on delete set null,
  adaptation_metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists recipes_original_recipe_id_idx on recipes (original_recipe_id);

-- INGREDIENTS
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  name text not null,
  quantity text,
  unit text,
  category text default 'other'
);

-- COOKING LOG
create table if not exists cooking_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  recipe_id uuid references recipes(id) on delete cascade not null,
  cooked_at timestamptz default now(),
  notes text
);

-- WEEKLY PLANS
create table if not exists weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  week_start date not null,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- WEEKLY PLAN SLOTS
create table if not exists weekly_plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references weekly_plans(id) on delete cascade not null,
  recipe_id uuid references recipes(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  meal_type text default 'dinner'
);

-- COOKBOOKS
create table if not exists cookbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

-- COOKBOOK RECIPES (many-to-many join table)
create table if not exists cookbook_recipes (
  id uuid primary key default gen_random_uuid(),
  cookbook_id uuid references cookbooks(id) on delete cascade not null,
  recipe_id uuid references recipes(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (cookbook_id, recipe_id)
);

alter table cookbooks enable row level security;
alter table cookbook_recipes enable row level security;

-- Cookbooks policies
create policy "Users can view own cookbooks"
  on cookbooks for select using (auth.uid() = user_id);
create policy "Users can insert own cookbooks"
  on cookbooks for insert with check (auth.uid() = user_id);
create policy "Users can update own cookbooks"
  on cookbooks for update using (auth.uid() = user_id);
create policy "Users can delete own cookbooks"
  on cookbooks for delete using (auth.uid() = user_id);

-- Cookbook recipes policies (inherit via cookbook ownership)
create policy "Users can view own cookbook recipes"
  on cookbook_recipes for select using (
    exists (select 1 from cookbooks where cookbooks.id = cookbook_recipes.cookbook_id and cookbooks.user_id = auth.uid())
  );
create policy "Users can insert own cookbook recipes"
  on cookbook_recipes for insert with check (
    exists (select 1 from cookbooks where cookbooks.id = cookbook_recipes.cookbook_id and cookbooks.user_id = auth.uid())
  );
create policy "Users can update own cookbook recipes"
  on cookbook_recipes for update using (
    exists (select 1 from cookbooks where cookbooks.id = cookbook_recipes.cookbook_id and cookbooks.user_id = auth.uid())
  );
create policy "Users can delete own cookbook recipes"
  on cookbook_recipes for delete using (
    exists (select 1 from cookbooks where cookbooks.id = cookbook_recipes.cookbook_id and cookbooks.user_id = auth.uid())
  );

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table cooking_log enable row level security;
alter table weekly_plans enable row level security;
alter table weekly_plan_slots enable row level security;

-- RECIPES policies
create policy "Users can view own recipes"
  on recipes for select using (auth.uid() = user_id);
create policy "Users can insert own recipes"
  on recipes for insert with check (auth.uid() = user_id);
create policy "Users can update own recipes"
  on recipes for update using (auth.uid() = user_id);
create policy "Users can delete own recipes"
  on recipes for delete using (auth.uid() = user_id);

-- INGREDIENTS policies (inherit via recipe ownership)
create policy "Users can view ingredients of own recipes"
  on ingredients for select using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );
create policy "Users can insert ingredients to own recipes"
  on ingredients for insert with check (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );
create policy "Users can update ingredients of own recipes"
  on ingredients for update using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );
create policy "Users can delete ingredients of own recipes"
  on ingredients for delete using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );

-- COOKING LOG policies
create policy "Users can view own cooking log"
  on cooking_log for select using (auth.uid() = user_id);
create policy "Users can insert own cooking log"
  on cooking_log for insert with check (auth.uid() = user_id);
create policy "Users can update own cooking log"
  on cooking_log for update using (auth.uid() = user_id);
create policy "Users can delete own cooking log"
  on cooking_log for delete using (auth.uid() = user_id);

-- WEEKLY PLANS policies
create policy "Users can view own plans"
  on weekly_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans"
  on weekly_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plans"
  on weekly_plans for update using (auth.uid() = user_id);
create policy "Users can delete own plans"
  on weekly_plans for delete using (auth.uid() = user_id);

-- WEEKLY PLAN SLOTS policies
create policy "Users can view own plan slots"
  on weekly_plan_slots for select using (
    exists (select 1 from weekly_plans where weekly_plans.id = weekly_plan_slots.plan_id and weekly_plans.user_id = auth.uid())
  );
create policy "Users can insert own plan slots"
  on weekly_plan_slots for insert with check (
    exists (select 1 from weekly_plans where weekly_plans.id = weekly_plan_slots.plan_id and weekly_plans.user_id = auth.uid())
  );
create policy "Users can update own plan slots"
  on weekly_plan_slots for update using (
    exists (select 1 from weekly_plans where weekly_plans.id = weekly_plan_slots.plan_id and weekly_plans.user_id = auth.uid())
  );
create policy "Users can delete own plan slots"
  on weekly_plan_slots for delete using (
    exists (select 1 from weekly_plans where weekly_plans.id = weekly_plan_slots.plan_id and weekly_plans.user_id = auth.uid())
  );

-- ============================================================
-- FEATURE 09 · SOCIAL (friends, households, shared collections, activity feed)
-- Mirrors supabase/migrations/add_social_*.sql — idempotent, safe to re-run.
-- ============================================================

-- ── Slice 1 · Identity ──────────────────────────────────────
create extension if not exists citext;

alter table profiles
  add column if not exists username citext unique,
  add column if not exists display_name text,
  add column if not exists avatar_url text;

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

insert into profiles (id, display_name, avatar_url)
select id,
       raw_user_meta_data->>'full_name',
       raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do update set
  display_name = coalesce(profiles.display_name, excluded.display_name),
  avatar_url   = coalesce(profiles.avatar_url, excluded.avatar_url);

drop view if exists public_profiles;
create view public_profiles
  with (security_invoker = false)
as
  select id, username, display_name, avatar_url
  from profiles
  where username is not null;
grant select on public_profiles to authenticated;

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

-- ── Slice 2 · Friendships ───────────────────────────────────
create table if not exists friendships (
  user_id_a    uuid not null references auth.users on delete cascade,
  user_id_b    uuid not null references auth.users on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  requested_by uuid not null references auth.users,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index if not exists friendships_a_accepted_idx on friendships (user_id_a) where status = 'accepted';
create index if not exists friendships_b_accepted_idx on friendships (user_id_b) where status = 'accepted';

alter table friendships enable row level security;
drop policy if exists "friendship participants can select" on friendships;
create policy "friendship participants can select"
  on friendships for select
  using (auth.uid() = user_id_a or auth.uid() = user_id_b);

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

create or replace function send_friend_request(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a  uuid := least(me, target_id);
  b  uuid := greatest(me, target_id);
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if me = target_id then raise exception 'Cannot friend yourself'; end if;
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
    and requested_by = other_id
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

-- ── Slice 3 · Households + per-person rankings ──────────────
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz default now()
);
create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);
create table if not exists household_invites (
  token uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table households        enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
create index if not exists household_members_user_id_idx on household_members (user_id);

create or replace function is_household_member(hh uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from household_members where household_id = hh and user_id = auth.uid())
$$;
grant execute on function is_household_member(uuid) to authenticated;

create or replace function same_household(u1 uuid, u2 uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from household_members hm1
    join household_members hm2 using (household_id)
    where hm1.user_id = u1 and hm2.user_id = u2
  )
$$;
grant execute on function same_household(uuid, uuid) to authenticated;

drop policy if exists "Members can view their households" on households;
create policy "Members can view their households"
  on households for select using (is_household_member(id));
drop policy if exists "Members can view household members" on household_members;
create policy "Members can view household members"
  on household_members for select using (is_household_member(household_id));

create or replace function create_household(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hid uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from household_members where user_id = me) then
    raise exception 'You are already in a household';
  end if;
  insert into households (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Household'), me) returning id into hid;
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
  insert into household_invites (household_id, created_by) values (p_household, me) returning token into tok;
  return tok;
end;
$$;
grant execute on function create_household_invite(uuid) to authenticated;

create or replace function household_invite_info(p_token uuid)
returns table (household_id uuid, name text)
language sql security definer stable set search_path = public as $$
  select h.id, h.name from household_invites i
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
  insert into household_members (household_id, user_id, role) values (hid, me, 'member') on conflict do nothing;
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

drop policy if exists "Household cookbook recipes - select" on cookbook_recipes;
create policy "Household cookbook recipes - select"
  on cookbook_recipes for select using (
    exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id
      and c.owner_scope = 'household' and c.household_id is not null and is_household_member(c.household_id)));
drop policy if exists "Household cookbook recipes - insert" on cookbook_recipes;
create policy "Household cookbook recipes - insert"
  on cookbook_recipes for insert with check (
    exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id
      and c.owner_scope = 'household' and c.household_id is not null and is_household_member(c.household_id)));
drop policy if exists "Household cookbook recipes - delete" on cookbook_recipes;
create policy "Household cookbook recipes - delete"
  on cookbook_recipes for delete using (
    exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id
      and c.owner_scope = 'household' and c.household_id is not null and is_household_member(c.household_id)));

drop policy if exists "Household recipe ingredients - select" on ingredients;
create policy "Household recipe ingredients - select"
  on ingredients for select using (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id
      and r.owner_scope = 'household' and r.household_id is not null and is_household_member(r.household_id)));
drop policy if exists "Household recipe ingredients - insert" on ingredients;
create policy "Household recipe ingredients - insert"
  on ingredients for insert with check (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id
      and r.owner_scope = 'household' and r.household_id is not null and is_household_member(r.household_id)));
drop policy if exists "Household recipe ingredients - update" on ingredients;
create policy "Household recipe ingredients - update"
  on ingredients for update using (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id
      and r.owner_scope = 'household' and r.household_id is not null and is_household_member(r.household_id)));
drop policy if exists "Household recipe ingredients - delete" on ingredients;
create policy "Household recipe ingredients - delete"
  on ingredients for delete using (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id
      and r.owner_scope = 'household' and r.household_id is not null and is_household_member(r.household_id)));

create table if not exists recipe_rankings (
  user_id uuid not null references auth.users on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  rank integer not null,
  updated_at timestamptz default now(),
  primary key (user_id, recipe_id),
  unique (user_id, rank) deferrable initially deferred
);
alter table recipe_rankings enable row level security;
drop policy if exists "Users can manage own recipe rankings" on recipe_rankings;
create policy "Users can manage own recipe rankings"
  on recipe_rankings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into recipe_rankings (user_id, recipe_id, rank)
select user_id, id, rank from recipes where rank is not null
on conflict (user_id, recipe_id) do nothing;

-- ── Slice 4 · Visibility + friend browse ────────────────────
alter table recipes   add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));
alter table cookbooks add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));
create index if not exists recipes_user_id_idx   on recipes   (user_id);
create index if not exists cookbooks_user_id_idx on cookbooks (user_id);

drop policy if exists "Friends can view friend recipes" on recipes;
create policy "Friends can view friend recipes"
  on recipes for select
  using (visibility = 'friends' and are_friends(user_id, auth.uid()));
drop policy if exists "Friends can view friend cookbooks" on cookbooks;
create policy "Friends can view friend cookbooks"
  on cookbooks for select
  using (visibility = 'friends' and are_friends(user_id, auth.uid()));
drop policy if exists "Friends can view cookbook_recipes of visible cookbooks" on cookbook_recipes;
create policy "Friends can view cookbook_recipes of visible cookbooks"
  on cookbook_recipes for select
  using (exists (
    select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id
      and c.visibility = 'friends' and are_friends(c.user_id, auth.uid())));
drop policy if exists "Friends can view ingredients of visible recipes" on ingredients;
create policy "Friends can view ingredients of visible recipes"
  on ingredients for select
  using (exists (
    select 1 from recipes r where r.id = ingredients.recipe_id
      and r.visibility = 'friends' and are_friends(r.user_id, auth.uid())));

-- ── Slice 5 · Activity feed ─────────────────────────────────
create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references auth.users on delete cascade,
  type        text not null
    check (type in ('recipe_created', 'recipe_cooked', 'cookbook_created')),
  recipe_id   uuid references recipes(id)   on delete cascade,
  cookbook_id uuid references cookbooks(id) on delete cascade,
  created_at  timestamptz default now()
);
create index if not exists activity_actor_created_idx on activity (actor_id, created_at desc);
alter table activity enable row level security;
drop policy if exists "View own and friends' activity" on activity;
create policy "View own and friends' activity"
  on activity for select
  using (actor_id = auth.uid() or are_friends(actor_id, auth.uid()));
drop policy if exists "Insert own activity" on activity;
create policy "Insert own activity"
  on activity for insert
  with check (actor_id = auth.uid());
