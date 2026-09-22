import { anthropic, HAIKU } from '@/lib/anthropic'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_VALUES, type RecipeCategory } from '@/lib/recipe-categories'

/**
 * Tag a recipe with every category from RECIPE_CATEGORIES that fits — e.g.
 * chicken noodle soup → poultry, noodles, soup. Returns [] when none apply
 * (drinks, most desserts) and null on any failure, so the caller leaves the
 * field alone rather than guessing.
 */
export async function classifyRecipeCategories(
  recipeName: string,
  description: string | null | undefined,
  instructions: string | null | undefined,
  ingredientNames: string[] = []
): Promise<RecipeCategory[] | null> {
  if (!recipeName?.trim()) return null
  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `You are a culinary expert. Tag this recipe with every category that describes it.\n\nRecipe: "${recipeName}"\n${description ? `Description: ${description.slice(0, 500)}\n` : ''}${ingredientNames.length ? `Ingredients: ${ingredientNames.slice(0, 40).join(', ')}\n` : ''}${instructions ? `Instructions:\n${instructions.slice(0, 1500)}\n` : ''}
Categories:
${RECIPE_CATEGORIES.map(c => `- ${c.value} — ${c.hint}`).join('\n')}

Pick every category that fits, based on the main components of the dish — not garnishes or stock (chicken stock alone does not make a dish poultry). Pick none if nothing fits, e.g. drinks and most desserts.

Answer with the chosen category words separated by commas, or "none". No other text.`,
      }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return null
    const words = content.text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    return RECIPE_CATEGORY_VALUES.filter(v => words.includes(v))
  } catch (error) {
    console.error('classifyRecipeCategories error:', error)
    return null
  }
}
