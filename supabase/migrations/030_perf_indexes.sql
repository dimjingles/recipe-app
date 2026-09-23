-- Performance: index the foreign-key / filter columns the app queries on.
--
-- Postgres doesn't index FK columns automatically, so every recipe-detail
-- ingredients embed, planner slot embed, cooking-log lookup and ON DELETE
-- CASCADE from `recipes` was a sequential scan of the child table.
-- Idempotent — safe to re-run.

create index if not exists ingredients_recipe_id_idx      on ingredients (recipe_id);
create index if not exists cooking_log_user_cooked_idx    on cooking_log (user_id, cooked_at desc);
create index if not exists cooking_log_recipe_cooked_idx  on cooking_log (recipe_id, cooked_at desc);
create index if not exists weekly_plan_slots_recipe_id_idx on weekly_plan_slots (recipe_id);
create index if not exists cookbook_recipes_recipe_id_idx on cookbook_recipes (recipe_id);
create index if not exists recipe_rankings_recipe_id_idx  on recipe_rankings (recipe_id);
-- The partial accepted-only index can't serve pending-request lookups.
create index if not exists friendships_b_idx              on friendships (user_id_b);
create index if not exists activity_recipe_id_idx   on activity (recipe_id)   where recipe_id is not null;
create index if not exists activity_cookbook_id_idx on activity (cookbook_id) where cookbook_id is not null;

-- Library / friend-profile lists filter by owner and sort newest-first. The
-- composite index covers plain user_id lookups too, so it replaces the old one.
create index if not exists recipes_user_created_idx on recipes (user_id, created_at desc);
drop index if exists recipes_user_id_idx;

-- One recipe per (plan, day, meal). Lets the slots route upsert instead of
-- delete-then-insert. Drop any duplicates first (keeping one row each).
delete from weekly_plan_slots s
using weekly_plan_slots other
where s.plan_id = other.plan_id
  and s.day_of_week = other.day_of_week
  and s.meal_type = other.meal_type
  and s.id < other.id;
create unique index if not exists weekly_plan_slots_plan_day_meal_uidx
  on weekly_plan_slots (plan_id, day_of_week, meal_type);

-- GoTrue stores emails lowercased; comparing lower(u.email) defeated the
-- auth.users email index and scanned every user.
create or replace function find_user_by_email(lookup_email text)
returns table (id uuid, username citext, display_name text, avatar_url text)
language plpgsql security definer stable set search_path = public as $$
begin
  return query
    select p.id, p.username, p.display_name, p.avatar_url
    from auth.users u
    join profiles p on p.id = u.id
    where u.email = lower(lookup_email)
      and p.username is not null
    limit 1;
end;
$$;
