import { anthropic, HAIKU, QUICK_CALL } from '@/lib/anthropic'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_VALUES, type RecipeCategory } from '@/lib/recipe-categories'
import { RECIPE_TYPE_VALUES, isRecipeType, type RecipeType } from '@/lib/ai/classify-recipe-type'

export type RecipeLabels = { recipe_type: RecipeType | null; categories: RecipeCategory[] | null }

/**
 * Course (`recipe_type`) and descriptive categories in ONE Haiku call — the save
 * path used to make two. Only the requested fields are asked for. Each field is
 * null when it wasn't requested or the call failed, so the caller leaves it alone.
 */
export async function classifyRecipeLabels(
  recipe: {
    name: string
    description?: string | null
    instructions?: string | null
    ingredientNames?: string[]
  },
  want: { type: boolean; categories: boolean },
): Promise<RecipeLabels> {
  const none: RecipeLabels = { recipe_type: null, categories: null }
  if (!recipe.name?.trim() || (!want.type && !want.categories)) return none

  const properties: Record<string, unknown> = {}
  if (want.type) properties.recipe_type = { type: 'string', enum: [...RECIPE_TYPE_VALUES] }
  if (want.categories) {
    properties.categories = { type: 'array', items: { type: 'string', enum: [...RECIPE_CATEGORY_VALUES] } }
  }

  const ingredients = recipe.ingredientNames?.filter(Boolean).slice(0, 40) ?? []
  const questions = [
    want.type &&
      `recipe_type — the single course it belongs to:
- appetizer — starters, snacks, sides, dips, small plates
- main — the centrepiece of a meal, including breakfast and lunch dishes
- dessert — sweet courses, baked goods, ice cream, confections
- drink — cocktails, smoothies, coffee, tea, juices, any beverage`,
    want.categories &&
      `categories — every category that describes the dish, based on its main components, not garnishes or stock (chicken stock alone does not make a dish poultry). Use an empty list if none fit, e.g. drinks and most desserts:
${RECIPE_CATEGORIES.map(c => `- ${c.value} — ${c.hint}`).join('\n')}`,
  ].filter(Boolean)

  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 128,
      output_config: {
        format: {
          type: 'json_schema',
          schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
        },
      },
      messages: [{
        role: 'user',
        content: `You are a culinary expert. Classify this recipe.

Recipe: "${recipe.name}"
${recipe.description ? `Description: ${recipe.description.slice(0, 500)}\n` : ''}${ingredients.length ? `Ingredients: ${ingredients.join(', ')}\n` : ''}${recipe.instructions ? `Instructions:\n${recipe.instructions.slice(0, 1500)}\n` : ''}
${questions.join('\n\n')}`,
      }],
    }, QUICK_CALL)
    const content = message.content[0]
    if (message.stop_reason === 'refusal' || content?.type !== 'text') return none
    const parsed = JSON.parse(content.text) as { recipe_type?: unknown; categories?: unknown }
    return {
      recipe_type: want.type && isRecipeType(parsed.recipe_type) ? parsed.recipe_type : null,
      categories: want.categories && Array.isArray(parsed.categories)
        ? RECIPE_CATEGORY_VALUES.filter(v => (parsed.categories as unknown[]).includes(v))
        : null,
    }
  } catch (error) {
    console.error('classifyRecipeLabels error:', error)
    return none
  }
}
