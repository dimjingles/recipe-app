-- Remember the library's recipe-type filter per user, defaulting to Mains.
-- 'all' is a sentinel for "no filter" so the choice survives a round-trip
-- (a null would be indistinguishable from "column never set").
alter table profiles
  add column if not exists recipe_type_filter text not null default 'main';

alter table profiles
  drop constraint if exists profiles_recipe_type_filter_check;

alter table profiles
  add constraint profiles_recipe_type_filter_check
  check (recipe_type_filter in ('all', 'appetizer', 'main', 'dessert', 'drink'));
