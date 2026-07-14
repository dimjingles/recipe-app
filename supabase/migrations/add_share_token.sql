-- Public share links.
--
-- A recipe with a non-null share_token is publicly viewable (read-only) at
-- /share/<token> by anyone, no account required. The token is an unguessable
-- UUID so the link can't be enumerated, and clearing it revokes access.
--
-- Public reads are served server-side via the service-role client (see
-- src/lib/supabase/admin.ts) scoped strictly to `where share_token = <token>`,
-- so no anonymous RLS policy is added here — the anon role still cannot read
-- recipes directly.

alter table recipes add column if not exists share_token uuid unique;
