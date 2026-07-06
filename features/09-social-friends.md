# 09 - Social: Friends, Households, Shared Collections & Activity Feed

**Depends on:** Nothing in the existing 00-08 chain, but must be built in the vertical
slice order defined below. Partially absorbs feature 11's shared recipe-library use case;
feature 11 keeps shared planner, grocery, and cooking-history sync.

---

## What it builds

Users add each other as **mutual friends** (request -> accept). Partners can also create
a **household** so both accounts see the same shared recipes and cookbooks while keeping
separate per-person rankings for those recipes. Friends can browse each other's visible
cookbooks and recipes by default, with a per-item private toggle to hide anything. A
**friends and household activity feed** on the home screen shows what connected people are
cooking and creating.

## Why (north star alignment)

Seeing a friend's recipes and their cooking log is one of the most powerful nudges to
cook more - and a source of new recipe ideas. The household use case is even more core:
couples often cook from the same library but disagree on favourites, so the app must let
them share the underlying recipes/cookbooks without forcing one shared ranking. Directly
serves the metric: home-cooked meals per active user per week.

---

## Key constraints

- **RLS is the only security layer.** The app uses the anon key everywhere (no service
  role). Friend visibility must be enforced via additive RLS policies + `SECURITY
  DEFINER` functions — not app-layer checks.
- **Visibility chain is 4 levels deep:** `cookbooks → cookbook_recipes → recipes →
  ingredients`. A friend-read policy must be added at every level or nested data silently
  filters out.
- **No identity fields exist today.** `profiles` has no username/display name/avatar and
  is created lazily at onboarding. Social needs guaranteed rows + captured identity before
  anything else.
- **Images are already public.** `recipe-images` bucket is public (see
  `add_gallery_images.sql`) — no storage changes needed for friends to see photos.
- **Recipe rank is currently on `recipes.rank`.** Household sharing requires moving the
  effective ranking to a per-user table keyed by `(user_id, recipe_id)` so two household
  members can see the same recipe at different positions. Keep `recipes.rank` only as a
  migration/backfill source or legacy fallback.
- **Types are hand-maintained.** `src/types/database.ts` has `Functions: Record<string,
  never>` - every new RPC must be added there manually.
- **Migrations are manual SQL files** pasted into the Supabase SQL Editor.

---

## Build sequence - ship as vertical slices in this order

### Slice 1 — Identity (prerequisite for everything)

**Migration: `add_social_identity.sql`**
```sql
-- citext for case-insensitive unique handles
create extension if not exists citext;

alter table profiles
  add column if not exists username citext unique,
  add column if not exists display_name text,
  add column if not exists avatar_url text;

-- Trigger: auto-create profile on Google OAuth signup,
-- seeding display_name + avatar_url from Google metadata
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

-- Backfill existing users who completed onboarding without a name/avatar
insert into profiles (id, display_name, avatar_url)
select id,
       raw_user_meta_data->>'full_name',
       raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do update set
  display_name = coalesce(profiles.display_name, excluded.display_name),
  avatar_url   = coalesce(profiles.avatar_url, excluded.avatar_url);

-- Public-safe view: exposes ONLY the 4 safe identity columns.
-- Base profiles stays self-only so diet/allergies/goals never leak.
create or replace view public_profiles
  with (security_invoker = false)
as
  select id, username, display_name, avatar_url
  from profiles
  where username is not null;
grant select on public_profiles to authenticated;

-- Email discovery: exact match only, returns at most 1 row, prevents enumeration
create or replace function find_user_by_email(lookup_email text)
returns table (id uuid, username citext, display_name text, avatar_url text)
language plpgsql security definer stable set search_path = public as $$
begin
  return query
    select p.id, p.username, p.display_name, p.avatar_url
    from auth.users u
    join profiles p on p.id = u.id
    where lower(u.email) = lower(lookup_email)
    limit 1;
end;
$$;
grant execute on function find_user_by_email(text) to authenticated;
```

**Profile RLS update:** add a new SELECT policy so users can read `public_profiles` (the
view handles column-level safety; the base `profiles` select policy `auth.uid() = id`
is unchanged). No base policy change needed — the view's `security_invoker = false` runs
with the view owner's rights.

**New UI:**
- Add a username-capture step to `src/app/onboarding/onboarding-wizard.tsx` (required;
  block completion without one).
- New page `src/app/profile/page.tsx` — edit display name, @username, avatar (upload or
  keep Google default). Entry point: avatar in the home page header (`src/app/page.tsx`).
- New `src/lib/db/social.ts` with `getPublicProfile(username)`, `searchUsers(query)`,
  `findUserByEmail(email)`, `updateProfile({username, display_name, avatar_url})`.
- New API routes: `GET/PATCH /api/profile` (own profile identity fields only).

---

### Slice 2 — Social graph (friends)

**Migration: `add_friendships.sql`**
```sql
create table friendships (
  user_id_a   uuid not null references auth.users on delete cascade,
  user_id_b   uuid not null references auth.users on delete cascade,
  status      text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  requested_by uuid not null references auth.users,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)   -- canonical ordering: one row per pair, no duplicates
);

-- Fast lookup for "accepted friends of user X"
create index on friendships (user_id_a) where status = 'accepted';
create index on friendships (user_id_b) where status = 'accepted';

alter table friendships enable row level security;

-- Participants can see their own friendship rows
create policy "friendship participants can select"
  on friendships for select
  using (auth.uid() = user_id_a or auth.uid() = user_id_b);

-- Writes go through SECURITY DEFINER RPCs only
-- (no direct insert/update/delete policies for the anon client)

-- Core primitive used by all visibility RLS policies
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

-- State-machine mutation RPCs
create or replace function send_friend_request(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a  uuid := least(me, target_id);
  b  uuid := greatest(me, target_id);
begin
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
  update friendships set
    status = case when do_accept then 'accepted' else 'blocked' end,
    updated_at = now()
  where user_id_a = a and user_id_b = b
    and requested_by = other_id   -- only the non-requester can respond
    and status = 'pending';
end;
$$;
grant execute on function respond_to_request(uuid, boolean) to authenticated;

create or replace function unfriend(other_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  delete from friendships
  where user_id_a = least(me, other_id)
    and user_id_b = greatest(me, other_id)
    and (auth.uid() = user_id_a or auth.uid() = user_id_b);
end;
$$;
grant execute on function unfriend(uuid) to authenticated;
```

**App layer - add to `src/lib/db/social.ts`:**
`sendFriendRequest(targetId)`, `respondToRequest(otherId, accept)`, `unfriend(otherId)`,
`getFriends()` (accepted, returns public profile rows), `getPendingRequests()` (incoming
where `requested_by != me`), `getSentRequests()` (pending where `requested_by = me`).

**New API routes `src/app/api/friends/`:**
- `GET /api/friends` — friend list
- `GET /api/friends/requests` — incoming pending requests
- `POST /api/friends/request` — `{ target_id }` → calls `send_friend_request`
- `POST /api/friends/respond` — `{ other_id, accept }` → calls `respond_to_request`
- `DELETE /api/friends` — `{ other_id }` → calls `unfriend`
- `GET /api/users/search?q=` — queries `public_profiles` by username prefix
- `POST /api/users/find-by-email` — calls `find_user_by_email` RPC

**New page `src/app/friends/page.tsx`** — "Friends" screen:
- Tabs: Friends | Requests | Find people
- Username search with debounce; email lookup input
- Invite link (`/u/[username]`) with copy + QR (generate QR client-side using a tiny
  inline library; the link works as a standalone profile page too)
- Pending request cards with Accept / Decline buttons
- Each friend row → taps to `/u/[username]`

---

### Slice 3 - Household library + personal rankings

**Migration: `add_households_and_rankings.sql`**
```sql
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

create or replace function same_household(u1 uuid, u2 uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from household_members hm1
    join household_members hm2 using (household_id)
    where hm1.user_id = u1 and hm2.user_id = u2
  )
$$;
grant execute on function same_household(uuid, uuid) to authenticated;

-- Shared ownership fields. `owner_scope = 'user'` keeps today's personal model;
-- `owner_scope = 'household'` means every household member reads the same recipe/cookbook.
alter table recipes
  add column if not exists owner_scope text not null default 'user'
    check (owner_scope in ('user', 'household')),
  add column if not exists household_id uuid references households(id) on delete cascade;

alter table cookbooks
  add column if not exists owner_scope text not null default 'user'
    check (owner_scope in ('user', 'household')),
  add column if not exists household_id uuid references households(id) on delete cascade;

-- Per-person rank for both personal and shared recipes.
create table recipe_rankings (
  user_id uuid not null references auth.users on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  rank integer not null,
  updated_at timestamptz default now(),
  primary key (user_id, recipe_id),
  unique (user_id, rank) deferrable initially deferred
);

alter table recipe_rankings enable row level security;

create policy "Users can manage own recipe rankings"
  on recipe_rankings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists household_members_user_id_idx on household_members (user_id);
create index if not exists recipes_household_id_idx on recipes (household_id);
create index if not exists cookbooks_household_id_idx on cookbooks (household_id);
```

**Household RLS additions:**
- Household members can select the `households` and `household_members` rows they belong to.
- Household members can select `recipes` / `cookbooks` where `owner_scope = 'household'`
  and their `auth.uid()` appears in `household_members` for that `household_id`.
- Household members can select/write `cookbook_recipes` for household cookbooks, but
  direct recipe/cookbook deletes should be admin-only or blocked behind RPCs to avoid one
  partner accidentally deleting the shared library.
- `ingredients` select/insert/update/delete policies must follow the visible/writable recipe.

**App behaviour:**
- Add a household invite flow from `/friends` or `/profile`: create household, invite partner
  by link/QR, accept into `household_members`.
- Shared household library uses the same recipe and cookbook IDs for both members. No recipe
  duplication for partner accounts.
- Recipe list ordering joins `recipe_rankings` for `auth.uid()` and sorts by that row, not by
  `recipes.rank`. If no row exists for the current user, the recipe appears in the unranked
  section until that user ranks it.
- Head-to-head ranking writes only `recipe_rankings` for the current user. It must never update
  another household member's rank.
- Existing `recipes.rank` values should be backfilled into `recipe_rankings` for the recipe
  owner during migration.

**App layer - add to `src/lib/db/social.ts` or new `src/lib/db/households.ts`:**
`createHousehold(name)`, `createHouseholdInvite()`, `acceptHouseholdInvite(token)`,
`getMyHousehold()`, `getHouseholdMembers()`, `convertRecipeToHouseholdShared(recipeId)`,
`convertCookbookToHouseholdShared(cookbookId)`, `getRecipeRanking(recipeId)`,
`upsertRecipeRanking(recipeId, rank)`.

**UI updates:**
- Household settings card on `/profile` or `/friends`: invite partner, member list, leave
  household, explain that rankings stay personal.
- Recipe library filter/toggle: Personal | Household | All.
- Recipe detail: show "Shared with household" badge and "Your rank" copy.
- Cookbook detail: show household-shared badge when `owner_scope = 'household'`.

---

### Slice 4 - Visibility & browse (the sharing gate)

**Migration: `add_visibility.sql`**
```sql
alter table recipes   add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));
alter table cookbooks add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));

-- Additive SELECT policies (Postgres OR-combines permissive policies;
-- existing owner policies are untouched - these are additional)

create policy "Friends can view friend recipes"
  on recipes for select
  using (visibility = 'friends' and are_friends(user_id, auth.uid()));

create policy "Friends can view friend cookbooks"
  on cookbooks for select
  using (visibility = 'friends' and are_friends(user_id, auth.uid()));

create policy "Friends can view cookbook_recipes of visible cookbooks"
  on cookbook_recipes for select
  using (exists (
    select 1 from cookbooks c
    where c.id = cookbook_recipes.cookbook_id
      and c.visibility = 'friends'
      and are_friends(c.user_id, auth.uid())
  ));

create policy "Friends can view ingredients of visible recipes"
  on ingredients for select
  using (exists (
    select 1 from recipes r
    where r.id = ingredients.recipe_id
      and r.visibility = 'friends'
      and are_friends(r.user_id, auth.uid())
  ));

-- Index support for friend-browse queries
create index if not exists recipes_user_id_idx   on recipes  (user_id);
create index if not exists cookbooks_user_id_idx on cookbooks (user_id);
```

Friend visibility is read-only discovery. Household sharing is collaborative ownership. Do
not model a spouse/partner as a friend who can browse and copy recipes; model them as a
household member reading the same household-owned recipe/cookbook rows, with personal rank
coming from `recipe_rankings`.

**App layer - add to `src/lib/db/social.ts`:**
`getFriendProfile(username)` (full public profile + recipe + cookbook counts),
`getFriendRecipes(userId)` (does NOT filter by `user_id = me`; relies on RLS),
`getFriendCookbooks(userId)` (same).

**New page `src/app/u/[username]/page.tsx`** — friend/public profile:
- Header: avatar, display name, @username, skill level badge, "Add friend / Pending /
  Friends" button, unfriend option.
- Cookbooks grid (reuse `CookbookWithCount` card pattern from `cookbooks-view.tsx`).
- Recent recipes grid (reuse `RecipeCard variant="grid"`).
- Tap cookbook → `/u/[username]/cookbooks/[id]` (read-only version of cookbook detail;
  no rename/delete/remove controls).
- Private items simply don't appear (RLS).

**Update `src/types/database.ts`:** add `visibility` column to `recipes.Row` / `Insert` /
`Update` and `cookbooks.Row` etc.; add `friendships` table; add `public_profiles` view;
add `are_friends`, `send_friend_request`, `respond_to_request`, `unfriend`,
`find_user_by_email` to the `Functions` record.

**Visibility toggles in UI:**
- `src/components/recipe-detail.tsx` — Friends/Private toggle in the header action row.
- `src/components/cookbook-detail-view.tsx` — same, in the header.

---

### Slice 5 - Activity feed

**Migration: `add_activity.sql`**
```sql
create table activity (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references auth.users on delete cascade,
  type        text not null
    check (type in ('recipe_created', 'recipe_cooked', 'cookbook_created')),
  recipe_id   uuid references recipes(id)   on delete cascade,
  cookbook_id uuid references cookbooks(id) on delete cascade,
  created_at  timestamptz default now()
);

-- Fast time-ordered fetch per actor (the fan-out-on-read query key)
create index on activity (actor_id, created_at desc);

alter table activity enable row level security;

-- Own activity + friends' activity (RLS auto-hides private recipe/cookbook subjects)
create policy "View own and friends' activity"
  on activity for select
  using (actor_id = auth.uid() or are_friends(actor_id, auth.uid()));
```

**Fan-out-on-read feed query** (executed in `src/lib/db/activity.ts`):
```sql
select a.*, p.username, p.display_name, p.avatar_url,
       r.name as recipe_name, r.image_url as recipe_image_url, r.visibility as recipe_visibility,
       c.name as cookbook_name, c.visibility as cookbook_visibility
from activity a
join public_profiles p on p.id = a.actor_id
left join recipes   r on r.id = a.recipe_id
left join cookbooks c on c.id = a.cookbook_id
where a.actor_id != auth.uid()          -- exclude own events
  and a.created_at < :cursor            -- cursor pagination
order by a.created_at desc
limit 20
```
RLS on `activity` limits to self+friends; RLS on `recipes`/`cookbooks` auto-excludes
private subjects — the join naturally drops them without extra filters.

**Emit activity** by extending existing write paths in `src/lib/db/`:
- `createRecipe()` in `recipes.ts` — insert `{ actor_id: user.id, type: 'recipe_created', recipe_id }`
- `createCookbook()` in `cookbooks.ts` — insert `{ actor_id: user.id, type: 'cookbook_created', cookbook_id }`
- `logCooking()` in `recipes.ts` — insert `{ actor_id: user.id, type: 'recipe_cooked', recipe_id }`

New `src/lib/db/activity.ts` with `getFeed(cursor?: string)` and `emitActivity(...)`.
New `GET /api/feed?cursor=` route handler.

**Home page update** (`src/app/page.tsx`):
- Add "Friends activity" section below "This Week" (above recent recipes) when user has
  friends. Feed items: actor avatar + name, action text ("cooked Thai Green Curry"),
  recipe thumbnail (if `friends`-visible), relative timestamp.
- Shows up to 5 events; "See all →" links to `/feed` (new page for the full paginated feed).
- Avatar in the home header links to `/profile`.

---

## Navigation

Add to `bottom-nav.tsx`:
```ts
{ href: '/friends', label: 'Friends', icon: Users }
```
Reorganise: remove Grocery from the nav bar (it's already linked from the Planner
page and the home dashboard); that frees one slot. Updated nav: Home | Recipes |
**+** | Skills | Planner | Friends.

---

## New files

| File | Purpose |
|------|---------|
| `supabase/migrations/add_social_identity.sql` | Identity columns, trigger, public_profiles, find_user_by_email |
| `supabase/migrations/add_friendships.sql` | friendships table, are_friends, mutation RPCs |
| `supabase/migrations/add_households_and_rankings.sql` | households, household members, shared ownership fields, per-user recipe rankings |
| `supabase/migrations/add_visibility.sql` | visibility columns, friend browse RLS policies |
| `supabase/migrations/add_activity.sql` | activity table + RLS |
| `src/lib/db/social.ts` | getPublicProfile, searchUsers, findUserByEmail, updateProfile, friend helpers, getFriendRecipes, getFriendCookbooks |
| `src/lib/db/households.ts` | household invite/membership helpers, shared library conversion, per-user ranking helpers |
| `src/lib/db/activity.ts` | getFeed, emitActivity |
| `src/app/profile/page.tsx` | Own profile edit |
| `src/app/friends/page.tsx` | Friends list, requests, search, invite link/QR |
| `src/app/u/[username]/page.tsx` | Friend public profile + collections |
| `src/app/u/[username]/cookbooks/[id]/page.tsx` | Read-only cookbook view |
| `src/app/feed/page.tsx` | Full paginated activity feed |
| `src/app/api/profile/route.ts` | GET/PATCH own identity fields |
| `src/app/api/friends/route.ts` | GET friends, DELETE (unfriend) |
| `src/app/api/friends/requests/route.ts` | GET pending requests |
| `src/app/api/friends/request/route.ts` | POST send request |
| `src/app/api/friends/respond/route.ts` | POST accept/decline |
| `src/app/api/users/search/route.ts` | GET username search |
| `src/app/api/users/find-by-email/route.ts` | POST email lookup |
| `src/app/api/feed/route.ts` | GET activity feed with cursor |

## Modified files

| File | Change |
|------|--------|
| `supabase/schema.sql` | Fold in all migrations |
| `src/types/database.ts` | Add friendships, households, household_members, recipe_rankings, activity, visibility/owner_scope columns, public_profiles view, all new RPC function types |
| `src/lib/db/recipes.ts` | Join/upsert `recipe_rankings` for current-user ordering; emit activity on createRecipe + logCooking |
| `src/lib/db/cookbooks.ts` | Emit activity on createCookbook |
| `src/components/recipe-detail.tsx` | Visibility toggle |
| `src/components/cookbook-detail-view.tsx` | Visibility toggle |
| `src/app/onboarding/onboarding-wizard.tsx` | Username capture step |
| `src/app/page.tsx` | Avatar → /profile, Friends activity feed section |
| `src/components/bottom-nav.tsx` | Add Friends tab, remove Grocery |

---

## Verification

- **Household ranking path:** A creates a household and invites B. A shares a cookbook
  and 10 recipes to the household. Both accounts see the same recipe IDs and cookbook IDs.
  A ranks "Thai Green Curry" #1 while B ranks it #7; each library shows their own order.
  A re-ranks the recipe and B's rank does not change.
- **Happy path:** two Google accounts — A sends friend request to B by username, B
  accepts. Both appear in each other's `/friends`. B visits `/u/A` and sees A's cookbooks
  and recipes including ingredients. A marks one recipe private -> it vanishes from B's
  view without page reload barrier.
- **RLS red-team (the core of "robust"):**
  - As B, directly call `supabase.from('recipes').select()` without a `user_id` filter
    -> only A's `friends`-visibility recipes appear; private recipes are absent.
  - As B, attempt `supabase.from('recipes').update({name:'hack'}).eq('id', A_recipe_id)`
    → 0 rows affected (owner-only write policies unchanged).
  - As B, call `supabase.from('cooking_log').select()` -> only B's own log (cooking_log
    has no additive friend policy by design).
  - A and B unfriend -> B immediately loses access to A's non-owned rows.
  - As B, directly update A's `recipe_rankings` row → blocked by RLS; B can only write
    rows where `recipe_rankings.user_id = auth.uid()`.
  - As C (not a friend of A), query A's recipes -> empty.
- **Feed:** A creates a recipe -> B's home feed shows the event with avatar + thumbnail.
  A logs a cook on a private recipe → event does NOT appear in B's feed.
- **Identity privacy:** direct query of `profiles` as B returns only B's own row; the
  `public_profiles` view returns only `id, username, display_name, avatar_url`.
- **Scalability check:** confirm `are_friends()` does an index-scan (not seq-scan) on
  the `friendships` PK for a dataset of 10K+ rows.
