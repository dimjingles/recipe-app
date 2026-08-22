-- Calories on recipes
-- Per-serving estimate, set manually in the recipe editor or filled in by the
-- AI generation/import paths. Null means "unknown" — the UI hides the badge.

alter table recipes add column if not exists calories integer;
