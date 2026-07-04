-- Add difficulty rating column to recipes table
-- 1 = easy (🔪), 2 = medium (🔪🔪), 3 = hard (🔪🔪🔪)
alter table recipes add column if not exists difficulty integer check (difficulty between 1 and 3);
