-- Add taste feedback column to recipes.
-- Used to calibrate the displayed 0.0–10.0 score into a subrange:
--   like    → 7.0–10.0
--   okay    → 4.0–6.9
--   dislike → 0.0–3.9
alter table recipes add column if not exists feedback text check (feedback in ('like', 'okay', 'dislike'));
