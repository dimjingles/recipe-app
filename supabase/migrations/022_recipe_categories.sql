-- Descriptive categories on recipes (meat, seafood, pasta, soup, …), shown as
-- the library's "Type" filter. A fixed vocabulary lives in
-- src/lib/ai/classify-recipe-categories.ts; a recipe can carry several.
-- Separate from recipe_type, which is the course (appetizer/main/dessert/drink)
-- and decides the ranking pool.

alter table recipes add column if not exists categories text[] not null default '{}';
