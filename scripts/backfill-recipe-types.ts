/**
 * One-time backfill: populate recipe_type for all existing recipes that don't
 * have one. The type decides which pool a recipe is ranked in (mains vs
 * desserts vs drinks), so untyped recipes all pile into the shared "other"
 * pool until this runs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-recipe-types.ts [options]
 *
 * Options:
 *   --dry-run        Classify and print, but write nothing.
 *   --user=<uuid>    Only this user's recipes. Omit to cover every user —
 *                    the service key bypasses RLS, so the default touches
 *                    the whole project.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * ANTHROPIC_API_KEY. Note that a plain `npx tsx script.ts` does NOT read
 * .env.local — only Next.js does that — so pass --env-file explicitly or
 * export the variables yourself. The service-role key bypasses RLS so the
 * script can read every user's recipes.
 *
 * The script is safe to re-run — it only processes rows where
 * recipe_type IS NULL.
 */

import { createClient } from '@supabase/supabase-js'
import { classifyRecipeType } from '../src/lib/ai/classify-recipe-type'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY — the classifier needs it')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const dryRun = process.argv.includes('--dry-run')
const userId = process.argv.find(a => a.startsWith('--user='))?.slice('--user='.length)

async function main() {
  console.log(
    `Fetching recipes to backfill… (${userId ? `user ${userId}` : 'ALL users'}` +
    `${dryRun ? ', dry run' : ''})`
  )
  let query = supabase
    .from('recipes')
    .select('id, name, description, instructions')
    .is('recipe_type', null)
  if (userId) query = query.eq('user_id', userId)
  const { data: recipes, error } = await query

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  if (!recipes?.length) { console.log('Nothing to backfill.'); return }

  console.log(`${recipes.length} recipe(s) to backfill.`)

  let ok = 0, skipped = 0, fail = 0
  for (const recipe of recipes) {
    try {
      const type = await classifyRecipeType(recipe.name, recipe.description, recipe.instructions)
      if (!type) {
        console.warn(`  [skip] ${recipe.id} — ${recipe.name} (no type inferred)`)
        skipped++
        continue
      }
      if (dryRun) {
        console.log(`  [dry]  ${recipe.id} — ${recipe.name} → ${type}`)
        ok++
        continue
      }
      const { error: upErr } = await supabase
        .from('recipes')
        .update({ recipe_type: type })
        .eq('id', recipe.id)
      if (upErr) throw upErr
      console.log(`  [ok]   ${recipe.id} — ${recipe.name} → ${type}`)
      ok++
    } catch (err) {
      console.error(`  [fail] ${recipe.id} — ${recipe.name}:`, err)
      fail++
    }
  }

  console.log(
    `\nDone. ${ok} ${dryRun ? 'would be backfilled' : 'backfilled'}, ` +
    `${skipped} skipped, ${fail} failed.`
  )
  if (dryRun) console.log('Dry run — nothing was written. Re-run without --dry-run to apply.')
}

main().catch(err => { console.error(err); process.exit(1) })
