/**
 * One-time backfill: populate instruction_steps for all existing recipes that
 * have instructions text but no structured steps yet.
 *
 * Usage:
 *   npx tsx scripts/backfill-instruction-steps.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL  and  SUPABASE_SERVICE_ROLE_KEY  in the environment
 *   (or a .env.local that exports them).  The service-role key bypasses RLS so
 *   the script can read all users' recipes.
 *
 * The script is safe to re-run — it only processes rows where
 * instruction_steps IS NULL AND instructions IS NOT NULL.
 */

import { createClient } from '@supabase/supabase-js'
import { structureInstructions } from '../src/lib/ai/structure-instructions'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('Fetching recipes to backfill…')
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, instructions')
    .is('instruction_steps', null)
    .not('instructions', 'is', null)

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  if (!recipes?.length) { console.log('Nothing to backfill.'); return }

  console.log(`${recipes.length} recipe(s) to backfill.`)

  let ok = 0, fail = 0
  for (const recipe of recipes) {
    try {
      const steps = await structureInstructions(recipe.name, recipe.instructions)
      if (steps.length === 0) {
        console.warn(`  [skip] ${recipe.id} — ${recipe.name} (no steps produced)`)
        continue
      }
      const { error: upErr } = await supabase
        .from('recipes')
        .update({ instruction_steps: steps })
        .eq('id', recipe.id)
      if (upErr) throw upErr
      console.log(`  [ok]   ${recipe.id} — ${recipe.name} (${steps.length} steps)`)
      ok++
    } catch (err) {
      console.error(`  [fail] ${recipe.id} — ${recipe.name}:`, err)
      fail++
    }
  }

  console.log(`\nDone. ${ok} backfilled, ${fail} failed.`)
}

main().catch(err => { console.error(err); process.exit(1) })
