-- ============================================================
-- Feature 09 · Slice 4 — Visibility & friend browse (the sharing gate)
--
-- Friend visibility is READ-ONLY discovery: additive SELECT policies only.
-- Owner write policies are untouched, so a friend can read a visible recipe
-- but can never update or delete it. The visibility chain is 4 levels deep:
-- cookbooks → cookbook_recipes → recipes → ingredients. A friend-read policy
-- exists at every level or nested data silently filters out.
-- ============================================================

alter table recipes   add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));
alter table cookbooks add column if not exists visibility text not null default 'friends'
  check (visibility in ('private', 'friends'));

create index if not exists recipes_user_id_idx   on recipes   (user_id);
create index if not exists cookbooks_user_id_idx on cookbooks (user_id);

-- Additive SELECT policies (Postgres OR-combines permissive policies).
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
    select 1 from cookbooks c
    where c.id = cookbook_recipes.cookbook_id
      and c.visibility = 'friends'
      and are_friends(c.user_id, auth.uid())
  ));

drop policy if exists "Friends can view ingredients of visible recipes" on ingredients;
create policy "Friends can view ingredients of visible recipes"
  on ingredients for select
  using (exists (
    select 1 from recipes r
    where r.id = ingredients.recipe_id
      and r.visibility = 'friends'
      and are_friends(r.user_id, auth.uid())
  ));
