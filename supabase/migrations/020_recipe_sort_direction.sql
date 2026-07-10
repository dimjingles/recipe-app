-- Allow reversing the recipe library sort (bottom-to-top) for any sort option.
alter table profiles
  add column if not exists recipe_sort_direction text not null default 'default'
  check (recipe_sort_direction in ('default', 'reversed'));
