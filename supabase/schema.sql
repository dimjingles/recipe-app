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
