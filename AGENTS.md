<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database migrations

Do not tell the user to paste SQL into the Supabase dashboard. Write the change as a new
`.sql` file in `supabase/migrations/`, fold it into `supabase/schema.sql` so fresh installs
get it, then apply it yourself:

```bash
npm run migrate -- <filename>.sql   # apply one
npm run migrate                     # status: applied vs pending
```

The runner (`scripts/migrate.mts`) goes through the Supabase Management API and records
what ran in a `schema_migrations` table, so re-running is safe. It needs
`SUPABASE_ACCESS_TOKEN` in `.env.local`; if it is missing, the script prints how to get one.

Keep migrations idempotent (`add column if not exists`, `create index if not exists`) — the
older files predate the ledger and may be re-run by hand.
