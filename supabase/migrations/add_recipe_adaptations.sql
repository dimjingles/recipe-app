-- AI Recipe Adaptation (feature 09)
-- Link an adapted recipe (a "variant") back to the original it was derived from,
-- without ever overwriting the original. The variant is a full, independent recipe
-- row; these columns only record its provenance.

-- FK back to the recipe this one was adapted from. Nullable: normal recipes have no origin.
-- ON DELETE SET NULL so deleting an original leaves the variant intact (just unlinked).
alter table recipes
  add column if not exists original_recipe_id uuid references recipes(id) on delete set null;

-- Provenance of the adaptation:
-- { adaptation_type, user_request, warnings: string[],
--   substitution_notes: string[], created_from_recipe_id, created_from_name }
alter table recipes
  add column if not exists adaptation_metadata jsonb;

-- Fast lookup of a recipe's variants.
create index if not exists recipes_original_recipe_id_idx on recipes (original_recipe_id);
