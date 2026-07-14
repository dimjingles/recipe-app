-- ============================================================
-- Remove the Household feature (collaborative shared libraries)
--
-- Reverses supabase/migrations/add_households_and_rankings.sql EXCEPT the
-- per-person rankings (recipe_rankings), which stay. Idempotent, safe to re-run.
--
-- Drops, in dependency order: the household RLS policies (they reference the
-- owner_scope/household_id columns), then those columns, then the household
-- lifecycle functions, then the household tables.
-- ============================================================

-- ── Household RLS policies on shared content ──
drop policy if exists "Household members can view household recipes"   on recipes;
drop policy if exists "Household members can edit household recipes"   on recipes;
drop policy if exists "Household members can view household cookbooks" on cookbooks;
drop policy if exists "Household members can edit household cookbooks" on cookbooks;
drop policy if exists "Household cookbook recipes - select" on cookbook_recipes;
drop policy if exists "Household cookbook recipes - insert" on cookbook_recipes;
drop policy if exists "Household cookbook recipes - delete" on cookbook_recipes;
drop policy if exists "Household recipe ingredients - select" on ingredients;
drop policy if exists "Household recipe ingredients - insert" on ingredients;
drop policy if exists "Household recipe ingredients - update" on ingredients;
drop policy if exists "Household recipe ingredients - delete" on ingredients;

-- ── Membership-list policies ──
drop policy if exists "Members can view their households"   on households;
drop policy if exists "Members can view household members"  on household_members;

-- ── Shared-ownership columns (drops the check constraints, FKs and indexes) ──
drop index if exists recipes_household_id_idx;
drop index if exists cookbooks_household_id_idx;
alter table recipes   drop column if exists owner_scope, drop column if exists household_id;
alter table cookbooks drop column if exists owner_scope, drop column if exists household_id;

-- ── Household lifecycle functions ──
drop function if exists create_household(text);
drop function if exists create_household_invite(uuid);
drop function if exists household_invite_info(uuid);
drop function if exists accept_household_invite(uuid);
drop function if exists leave_household(uuid);
drop function if exists is_household_member(uuid);
drop function if exists same_household(uuid, uuid);

-- ── Household tables ──
drop table if exists household_invites;
drop table if exists household_members;
drop table if exists households;
