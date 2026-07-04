-- ============================================================
-- Mise en Place — Supabase Schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

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
  image_url text,
  tags text[] default '{}',
  cooked_count integer default 0,
  last_cooked_at timestamptz,
  rank integer,
  created_at timestamptz default now()
);

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
