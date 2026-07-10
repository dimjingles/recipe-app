-- Allow sorting the recipe library by cook time.
alter table profiles
  drop constraint if exists profiles_recipe_sort_preference_check;

alter table profiles
  add constraint profiles_recipe_sort_preference_check
  check (recipe_sort_preference in ('ranking', 'recently_cooked', 'most_cooked', 'cook_time'));
