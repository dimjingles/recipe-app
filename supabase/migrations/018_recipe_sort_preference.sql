alter table profiles
  add column if not exists recipe_sort_preference text not null default 'ranking'
  check (recipe_sort_preference in ('ranking', 'recently_cooked', 'most_cooked'));
