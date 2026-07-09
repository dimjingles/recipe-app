-- ============================================================
-- Feature 09 · Slice 5 — Activity feed
--
-- Fan-out-on-read: one row per event, read back by joining friends' activity.
-- RLS limits rows to self + friends; the subject recipe/cookbook is separately
-- gated by its own RLS, so a private subject silently drops out of the feed.
-- ============================================================

create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references auth.users on delete cascade,
  type        text not null
    check (type in ('recipe_created', 'recipe_cooked', 'cookbook_created')),
  recipe_id   uuid references recipes(id)   on delete cascade,
  cookbook_id uuid references cookbooks(id) on delete cascade,
  created_at  timestamptz default now()
);

-- Time-ordered fetch per actor (the fan-out-on-read query key).
create index if not exists activity_actor_created_idx on activity (actor_id, created_at desc);

alter table activity enable row level security;

-- Read: own events + friends' events (private subjects are dropped by the join).
drop policy if exists "View own and friends' activity" on activity;
create policy "View own and friends' activity"
  on activity for select
  using (actor_id = auth.uid() or are_friends(actor_id, auth.uid()));

-- Write: only your own events (the anon client emits these directly).
drop policy if exists "Insert own activity" on activity;
create policy "Insert own activity"
  on activity for insert
  with check (actor_id = auth.uid());
