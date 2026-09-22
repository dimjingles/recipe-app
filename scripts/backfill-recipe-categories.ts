/**
 * Backfill: tag recipes with categories (meat, seafood, pasta, soup, …) — the
 * values behind the library's "Type" filter. New recipes are tagged on
 * POST /api/recipes; this covers rows created before that.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-recipe-categories.ts [options]
 *
 * Options:
 *   --dry-run        Classify and print, but write nothing.
 *   --user=<uuid>    Only this user's recipes. Omit to cover every user —
 *                    the service key bypasses RLS, so the default touches
 *                    the whole project.
 *   --all            Re-classify every recipe, not just untagged ones. Use
 *                    after adding a category to RECIPE_CATEGORIES.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * ANTHROPIC_API_KEY. Note that a plain `npx tsx script.ts` does NOT read
 * .env.local — only Next.js does that — so pass --env-file explicitly or
 * export the variables yourself.
 *
 * Safe to re-run. Without --all it only processes recipes with no categories;
 * recipes that genuinely have none (drinks, most desserts) are re-asked each
 * time, which is cheap.
 */

import { createClient } from '@supabase/supabase-js'
import { classifyRecipeCategories } from '../src/lib/ai/classify-recipe-categories'

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
const all = process.argv.includes('--all')
const userId = process.argv.find(a => a.startsWith('--user='))?.slice('--user='.length)

async function main() {
  console.log(
    `Fetching recipes to backfill… (${userId ? `user ${userId}` : 'ALL users'}` +
    `${all ? ', every recipe' : ', untagged only'}${dryRun ? ', dry run' : ''})`
  )
  let query = supabase
    .from('recipes')
    .select('id, name, description, instructions, categories, ingredients(name)')
  if (!all) query = query.eq('categories', '{}')
  if (userId) query = query.eq('user_id', userId)
  const { data: recipes, error } = await query

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  if (!recipes?.length) { console.log('Nothing to backfill.'); return }

  console.log(`${recipes.length} recipe(s) to backfill.`)

  let ok = 0, fail = 0
  for (const recipe of recipes) {
    try {
      const ingredientNames = (recipe.ingredients ?? []).map((i: { name: string }) => i.name)
      const categories = await classifyRecipeCategories(
        recipe.name, recipe.description, recipe.instructions, ingredientNames
      )
      if (!categories) throw new Error('classifier failed')
      const label = categories.length ? categories.join(', ') : '(none)'
      if (dryRun) {
        console.log(`  [dry]  ${recipe.id} — ${recipe.name} → ${label}`)
        ok++
        continue
      }
      const { error: upErr } = await supabase
        .from('recipes')
        .update({ categories })
        .eq('id', recipe.id)
      if (upErr) throw upErr
      console.log(`  [ok]   ${recipe.id} — ${recipe.name} → ${label}`)
      ok++
    } catch (err) {
      console.error(`  [fail] ${recipe.id} — ${recipe.name}:`, err)
      fail++
    }
  }

  console.log(`\nDone. ${ok} ${dryRun ? 'would be backfilled' : 'backfilled'}, ${fail} failed.`)
  if (dryRun) console.log('Dry run — nothing was written. Re-run without --dry-run to apply.')
}

main().catch(err => { console.error(err); process.exit(1) })
