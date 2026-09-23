-- RLS performance rewrite. Same access rules, cheaper to evaluate.
--
-- 1. Bare auth.uid() in a policy is re-evaluated for every row; wrapped as
--    (select auth.uid()) Postgres evaluates it once per statement (an
--    "initplan"). Supabase's advisor flags this as auth_rls_initplan.
-- 2. Friend visibility called are_friends(owner, auth.uid()) — a SECURITY
--    DEFINER function Postgres can't inline — once per row. my_friend_ids()
--    returns the caller's friend set once per statement instead.
-- 3. Tables with two permissive SELECT policies (own + friends') had both
--    evaluated on every row; each now has one combined policy. Child tables
--    (ingredients, cookbook_recipes) defer to the parent table's RLS instead of
--    re-implementing it.
--
-- Idempotent — safe to re-run.

create or replace function my_friend_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when user_id_a = auth.uid() then user_id_b else user_id_a end
  from friendships
  where status = 'accepted' and auth.uid() in (user_id_a, user_id_b)
$$;
revoke all on function my_friend_ids() from public;
grant execute on function my_friend_ids() to authenticated;

-- ── recipes ─────────────────────────────────────────────────
drop policy if exists "Users can view own recipes" on recipes;
drop policy if exists "Friends can view friend recipes" on recipes;
drop policy if exists "View own and friends' recipes" on recipes;
create policy "View own and friends' recipes" on recipes for select using (
  user_id = (select auth.uid())
  or (visibility = 'friends' and user_id in (select my_friend_ids()))
);
alter policy "Users can insert own recipes" on recipes with check (user_id = (select auth.uid()));
alter policy "Users can update own recipes" on recipes using (user_id = (select auth.uid()));
alter policy "Users can delete own recipes" on recipes using (user_id = (select auth.uid()));

-- ── ingredients (visible exactly when the parent recipe is) ─
drop policy if exists "Users can view ingredients of own recipes" on ingredients;
drop policy if exists "Friends can view ingredients of visible recipes" on ingredients;
drop policy if exists "View ingredients of visible recipes" on ingredients;
create policy "View ingredients of visible recipes" on ingredients for select using (
  exists (select 1 from recipes r where r.id = ingredients.recipe_id)
);
alter policy "Users can insert ingredients to own recipes" on ingredients with check (
  exists (select 1 from recipes r where r.id = ingredients.recipe_id and r.user_id = (select auth.uid()))
);
alter policy "Users can update ingredients of own recipes" on ingredients using (
  exists (select 1 from recipes r where r.id = ingredients.recipe_id and r.user_id = (select auth.uid()))
);
alter policy "Users can delete ingredients of own recipes" on ingredients using (
  exists (select 1 from recipes r where r.id = ingredients.recipe_id and r.user_id = (select auth.uid()))
);

-- ── cookbooks ───────────────────────────────────────────────
drop policy if exists "Users can view own cookbooks" on cookbooks;
drop policy if exists "Friends can view friend cookbooks" on cookbooks;
drop policy if exists "View own and friends' cookbooks" on cookbooks;
create policy "View own and friends' cookbooks" on cookbooks for select using (
  user_id = (select auth.uid())
  or (visibility = 'friends' and user_id in (select my_friend_ids()))
);
alter policy "Users can insert own cookbooks" on cookbooks with check (user_id = (select auth.uid()));
alter policy "Users can update own cookbooks" on cookbooks using (user_id = (select auth.uid()));
alter policy "Users can delete own cookbooks" on cookbooks using (user_id = (select auth.uid()));

-- ── cookbook_recipes (visible exactly when the cookbook is) ─
drop policy if exists "Users can view own cookbook recipes" on cookbook_recipes;
drop policy if exists "Friends can view cookbook_recipes of visible cookbooks" on cookbook_recipes;
drop policy if exists "View entries of visible cookbooks" on cookbook_recipes;
create policy "View entries of visible cookbooks" on cookbook_recipes for select using (
  exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id)
);
alter policy "Users can insert own cookbook recipes" on cookbook_recipes with check (
  exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id and c.user_id = (select auth.uid()))
);
alter policy "Users can update own cookbook recipes" on cookbook_recipes using (
  exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id and c.user_id = (select auth.uid()))
);
alter policy "Users can delete own cookbook recipes" on cookbook_recipes using (
  exists (select 1 from cookbooks c where c.id = cookbook_recipes.cookbook_id and c.user_id = (select auth.uid()))
);

-- ── owner-only tables ───────────────────────────────────────
alter policy "Users can view own cooking log"   on cooking_log using (user_id = (select auth.uid()));
alter policy "Users can insert own cooking log" on cooking_log with check (user_id = (select auth.uid()));
alter policy "Users can update own cooking log" on cooking_log using (user_id = (select auth.uid()));
alter policy "Users can delete own cooking log" on cooking_log using (user_id = (select auth.uid()));

alter policy "own profile - select" on profiles using (id = (select auth.uid()));
alter policy "own profile - insert" on profiles with check (id = (select auth.uid()));
alter policy "own profile - update" on profiles using (id = (select auth.uid()));

alter policy "Users can manage own recipe rankings" on recipe_rankings
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "Users can view own plans"   on weekly_plans using (user_id = (select auth.uid()));
alter policy "Users can insert own plans" on weekly_plans with check (user_id = (select auth.uid()));
alter policy "Users can update own plans" on weekly_plans using (user_id = (select auth.uid()));
alter policy "Users can delete own plans" on weekly_plans using (user_id = (select auth.uid()));

alter policy "Users can view own plan slots" on weekly_plan_slots using (
  exists (select 1 from weekly_plans p where p.id = weekly_plan_slots.plan_id and p.user_id = (select auth.uid()))
);
alter policy "Users can insert own plan slots" on weekly_plan_slots with check (
  exists (select 1 from weekly_plans p where p.id = weekly_plan_slots.plan_id and p.user_id = (select auth.uid()))
);
alter policy "Users can update own plan slots" on weekly_plan_slots using (
  exists (select 1 from weekly_plans p where p.id = weekly_plan_slots.plan_id and p.user_id = (select auth.uid()))
);
alter policy "Users can delete own plan slots" on weekly_plan_slots using (
  exists (select 1 from weekly_plans p where p.id = weekly_plan_slots.plan_id and p.user_id = (select auth.uid()))
);

-- ── social ──────────────────────────────────────────────────
alter policy "friendship participants can select" on friendships
  using ((select auth.uid()) in (user_id_a, user_id_b));

alter policy "View own and friends' activity" on activity using (
  actor_id = (select auth.uid()) or actor_id in (select my_friend_ids())
);
alter policy "Insert own activity" on activity with check (actor_id = (select auth.uid()));
