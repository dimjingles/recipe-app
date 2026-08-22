import { anthropic, HAIKU } from '@/lib/anthropic'

/** The values `recipes.recipe_type` can hold — the same enum the photo and
 *  dish-name extractors emit. Ranking pools are derived from these
 *  (see `rankGroup` in `@/lib/scoring`). */
export const RECIPE_TYPE_VALUES = ['appetizer', 'main', 'dessert', 'drink'] as const
export type RecipeType = (typeof RECIPE_TYPE_VALUES)[number]

export function isRecipeType(value: unknown): value is RecipeType {
  return RECIPE_TYPE_VALUES.includes(value as RecipeType)
}

/**
 * Infer a recipe's course from its name and instructions. Used to fill
 * `recipe_type` on creation paths that don't already supply one (URL/video
 * import, manual entry, AI adaptation) so every recipe lands in the right
 * ranking pool. Returns null on any failure — the caller leaves the field
 * alone rather than guessing.
 */
export async function classifyRecipeType(
  recipeName: string,
  description: string | null | undefined,
  instructions: string | null | undefined
): Promise<RecipeType | null> {
  if (!recipeName?.trim()) return null
  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 16,
      messages: [{
        role: 'user',
        content: `You are a culinary expert. Classify this recipe into exactly one course.\n\nRecipe: "${recipeName}"\n${description ? `Description: ${description.slice(0, 500)}\n` : ''}${instructions ? `Instructions:\n${instructions.slice(0, 1500)}\n` : ''}
Choose ONE of:
- appetizer — starters, snacks, sides, dips, small plates
- main — the centrepiece of a meal, including breakfast and lunch dishes
- dessert — sweet courses, baked goods, ice cream, confections
- drink — cocktails, smoothies, coffee, tea, juices, any beverage

Answer with the single word only, no punctuation or explanation.`,
      }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return null
    const answer = content.text.trim().toLowerCase().replace(/[^a-z]/g, '')
    return isRecipeType(answer) ? answer : null
  } catch (error) {
    console.error('classifyRecipeType error:', error)
    return null
  }
}
