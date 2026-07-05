-- ============================================================
-- Cookbooks — user-defined groupings of recipes (many-to-many)
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

create table if not exists cookbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

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
