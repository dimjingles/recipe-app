import { createClient } from '@/lib/supabase/server'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'
import { structureInstructions } from '@/lib/ai/structure-instructions'

/**
 * Fill in a recipe's techniques and structured steps from its instructions.
 * Runs inside after() on create/edit, so it must never throw. Techniques the
 * caller already supplied are kept as-is.
 */
export async function enrichRecipe(
  recipeId: string,
  userId: string,
  name: string | null | undefined,
  instructions: string,
  knownTechniques?: string[] | null,
): Promise<void> {
  try {
    const recipeName = name || 'Recipe'
    const [techniques, instruction_steps] = await Promise.all([
      knownTechniques?.length
        ? Promise.resolve(null)
        : getTechniqueKeys().then(keys => classifyTechniques(recipeName, instructions, keys)).catch(() => null),
      structureInstructions(recipeName, instructions),
    ])
    const update = {
      ...(techniques?.length ? { techniques } : {}),
      ...(instruction_steps.length ? { instruction_steps } : {}),
    }
    if (!Object.keys(update).length) return

    const supabase = await createClient()
    // Only if the instructions are still the ones we analysed — a quick
    // follow-up edit must not be overwritten by this older result.
    const { error } = await supabase
      .from('recipes')
      .update(update)
      .eq('id', recipeId)
      .eq('user_id', userId)
      .eq('instructions', instructions)
    if (error) console.error('enrichRecipe update error:', error)
  } catch (error) {
    console.error('enrichRecipe error:', error)
  }
}
