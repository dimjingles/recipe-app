/**
 * Migration runner for the Supabase Postgres database.
 *
 * Applies the .sql files in supabase/migrations/ over the Supabase Management
 * API (POST /v1/projects/{ref}/database/query — the same endpoint the dashboard
 * SQL editor uses), and records what ran in a `schema_migrations` ledger table
 * so re-running is a no-op.
 *
 * Usage:
 *   npm run migrate                        # status: what's applied, what's pending
 *   npm run migrate -- --all               # apply every pending migration, in filename order
 *   npm run migrate -- add_calories.sql    # apply specific file(s) by name or path
 *   npm run migrate -- --dry-run --all     # print the SQL without executing it
 *   npm run migrate -- --force <file>      # re-apply a file already in the ledger
 *   npm run migrate -- --baseline          # record all pending files as applied WITHOUT
 *                                          # running them (one-time, for migrations that
 *                                          # were already applied by hand in the dashboard)
 *
 * Requires in the environment (npm run migrate loads .env.local for you):
 *   SUPABASE_ACCESS_TOKEN     a Supabase access token with database write access.
 *                             Create at https://supabase.com/dashboard/account/tokens
 *   NEXT_PUBLIC_SUPABASE_URL  used to derive the project ref
 *                             (override with SUPABASE_PROJECT_REF)
 */

import { readFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const MIGRATIONS_DIR = resolve(import.meta.dirname, '..', 'supabase', 'migrations')
const LEDGER = 'schema_migrations'

// ── Config ────────────────────────────────────────────────────────────────────

function projectRef(): string {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) die('Set SUPABASE_PROJECT_REF, or NEXT_PUBLIC_SUPABASE_URL so the ref can be derived.')
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/.exec(url!)
  if (!m) die(`Could not derive a project ref from NEXT_PUBLIC_SUPABASE_URL (${url}).`)
  return m![1]
}

function accessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    die(
      'SUPABASE_ACCESS_TOKEN is not set.\n\n' +
      '  1. Create a token at https://supabase.com/dashboard/account/tokens\n' +
      '     (a fine-grained token scoped to this project with database write access is enough)\n' +
      '  2. Add it to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_...',
    )
  }
  return token!
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

// ── Management API ────────────────────────────────────────────────────────────

/** Run SQL against the project database. Returns the result rows. */
async function query(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )

  const text = await res.text()
  if (!res.ok) {
    // The API returns { message } or { error } depending on the failure mode.
    let detail = text
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string }
      detail = parsed.message || parsed.error || text
    } catch { /* keep the raw body */ }
    if (res.status === 401) {
      throw new Error(`Unauthorized (401) — check SUPABASE_ACCESS_TOKEN. ${detail}`)
    }
    if (res.status === 403) {
      throw new Error(
        `Forbidden (403) — the token lacks database write access to project ${projectRef()}. ${detail}`,
      )
    }
    throw new Error(`Query failed (${res.status}): ${detail}`)
  }

  if (!text) return []
  const parsed: unknown = JSON.parse(text)
  // Selects come back as a row array; DDL comes back as an empty array or an
  // object with no rows — normalise both to [].
  return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
}

// ── Ledger ────────────────────────────────────────────────────────────────────

async function ensureLedger(): Promise<void> {
  await query(`
    create table if not exists ${LEDGER} (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `)
}

async function appliedNames(): Promise<Set<string>> {
  const rows = await query(`select name from ${LEDGER};`)
  return new Set(rows.map(r => String(r.name)))
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
}

/** Escape a value for a single-quoted SQL literal. */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function showStatus(): Promise<void> {
  const applied = await appliedNames()
  const files = migrationFiles()
  const pending = files.filter(f => !applied.has(f))

  console.log(`\nProject ${projectRef()} — ${files.length} migration file(s)\n`)
  for (const f of files) {
    console.log(`  ${applied.has(f) ? '✓ applied' : '· pending'}  ${f}`)
  }
  // Ledger rows with no matching file: applied elsewhere, or the file was renamed/deleted.
  const orphans = [...applied].filter(n => !files.includes(n)).sort()
  if (orphans.length) {
    console.log('\n  Recorded but no longer on disk:')
    for (const n of orphans) console.log(`    ? ${n}`)
  }
  console.log(
    pending.length
      ? `\n${pending.length} pending. Apply with:  npm run migrate -- --all\n`
      : '\nEverything is applied.\n',
  )
}

async function apply(names: string[], opts: { force: boolean; dryRun: boolean }): Promise<void> {
  const applied = await appliedNames()

  for (const name of names) {
    const path = join(MIGRATIONS_DIR, name)
    let sql: string
    try {
      sql = readFileSync(path, 'utf8')
    } catch {
      die(`No such migration: ${name}  (looked in supabase/migrations/)`)
    }

    if (applied.has(name) && !opts.force) {
      console.log(`  ✓ ${name} — already applied, skipping (use --force to re-run)`)
      continue
    }

    if (opts.dryRun) {
      console.log(`\n── ${name} ──\n${sql!.trim()}\n`)
      continue
    }

    process.stdout.write(`  → ${name} … `)
    await query(sql!)
    // Record only after the migration itself succeeds.
    await query(
      `insert into ${LEDGER} (name) values (${lit(name)})
       on conflict (name) do update set applied_at = now();`,
    )
    console.log('applied')
  }
}

async function baseline(names: string[]): Promise<void> {
  if (!names.length) {
    console.log('\nNothing pending to baseline.\n')
    return
  }
  console.log('\nRecording as applied WITHOUT running (assumes these are already in the database):')
  for (const name of names) {
    await query(
      `insert into ${LEDGER} (name) values (${lit(name)}) on conflict (name) do nothing;`,
    )
    console.log(`  ✓ ${name}`)
  }
  console.log()
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flags = new Set(argv.filter(a => a.startsWith('--')))
  // Accept either a bare filename or a path like supabase/migrations/x.sql.
  const targets = argv.filter(a => !a.startsWith('--')).map(a => basename(a))

  const unknown = [...flags].filter(
    f => !['--all', '--dry-run', '--force', '--baseline', '--status'].includes(f),
  )
  if (unknown.length) die(`Unknown flag(s): ${unknown.join(', ')}`)

  await ensureLedger()

  if (flags.has('--baseline')) {
    const applied = await appliedNames()
    const pending = migrationFiles().filter(f => !applied.has(f))
    return baseline(targets.length ? targets : pending)
  }

  if (flags.has('--all')) {
    const applied = await appliedNames()
    const pending = migrationFiles().filter(f => flags.has('--force') || !applied.has(f))
    if (!pending.length) {
      console.log('\nEverything is applied.\n')
      return
    }
    console.log(`\nApplying ${pending.length} migration(s) to ${projectRef()}:`)
    await apply(pending, { force: flags.has('--force'), dryRun: flags.has('--dry-run') })
    console.log()
    return
  }

  if (targets.length) {
    console.log(`\nApplying to ${projectRef()}:`)
    await apply(targets, { force: flags.has('--force'), dryRun: flags.has('--dry-run') })
    console.log()
    return
  }

  await showStatus()
}

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err))
})
