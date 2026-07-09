import { anthropic, HAIKU, SONNET, extractJsonObject } from '@/lib/anthropic'
import type { AdaptationType, AdaptedRecipeDraft } from '@/types/database'

/** The subset of a recipe the adapter needs. Matches columns selected via getRecipe. */
export interface AdaptRecipeInput {
  id: string
  name: string
  description?: string | null
  cuisine?: string | null
  cook_time_minutes?: number | null
  servings?: number | null
  difficulty?: number | null
  tags?: string[] | null
  instructions?: string | null
  ingredients: Array<{ name: string; quantity?: string | null; unit?: string | null; category?: string | null }>
}

export interface AdaptOptions {
  adaptation_type: AdaptationType
  /** Free-text request (required for dietary_swap / freeform; optional otherwise). */
  request?: string
  /** Required for portion_scaling. */
  target_servings?: number
  /** Used by pantry_substitution. */
  missing_ingredients?: string[]
}

/**
 * Model choice by complexity. Portion scaling and named dietary swaps are
 * well-trodden and Haiku handles them reliably. Pantry substitution and freeform
 * requests are open-ended — the substitution reasoning and safety warnings
 * benefit from Sonnet.
 */
export function pickModel(type: AdaptationType): string {
  return type === 'pantry_substitution' || type === 'freeform' ? SONNET : HAIKU
}

/** Human-readable instruction for the model based on the adaptation type. */
function buildTask(opts: AdaptOptions, currentServings: number): string {
  const request = (opts.request || '').trim()
  switch (opts.adaptation_type) {
    case 'dietary_swap':
      return `Adapt this recipe to meet this dietary requirement: "${request}". Replace every non-compliant ingredient with a suitable alternative and rewrite the affected instruction steps so the method still works.`
    case 'portion_scaling': {
      const target = opts.target_servings ?? currentServings
      return `Rescale this recipe from ${currentServings} to ${target} servings. Scale every ingredient quantity proportionally, and ALSO adjust anything that does not scale linearly: cook/bake times, pan or pot sizes, oven temperatures, and resting times where they would realistically change. Do not simply multiply times by the same factor.`
    }
    case 'pantry_substitution': {
      const missing = (opts.missing_ingredients && opts.missing_ingredients.length)
        ? opts.missing_ingredients.join(', ')
        : request
      return `The cook does not have: ${missing}. Substitute the missing item(s) with realistic pantry alternatives, adjust quantities, and rewrite any instruction steps that change as a result. If a missing ingredient is essential and has no good substitute, keep it but clearly warn the user.`
    }
    case 'freeform':
    default:
      return `Adapt this recipe according to the cook's request: "${request}". Make only the changes needed to satisfy the request and keep the rest of the recipe intact.`
  }
}

function buildPrompt(recipe: AdaptRecipeInput, opts: AdaptOptions, currentServings: number): string {
  const ingredientList = (recipe.ingredients || [])
    .map(i => `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}${i.category ? ` (${i.category})` : ''}`)
    .join('\n') || '(none listed)'

  return `You are a professional recipe developer. Adapt the recipe below and return the result as JSON.

ORIGINAL RECIPE
Name: ${recipe.name}
${recipe.description ? `Description: ${recipe.description}\n` : ''}Cuisine: ${recipe.cuisine || 'unspecified'}
Servings: ${currentServings}
Cook time: ${recipe.cook_time_minutes ?? 'unspecified'} minutes
Difficulty (1 easy – 3 hard): ${recipe.difficulty ?? 'unspecified'}
Tags: ${(recipe.tags || []).join(', ') || 'none'}

INGREDIENTS
${ingredientList}

INSTRUCTIONS
${recipe.instructions || '(none listed)'}

YOUR TASK
${buildTask(opts, currentServings)}

RULES — READ CAREFULLY
- Be honest. If a substitution changes the result (texture, flavour, structure, rise, browning, cook time), you MUST say so in "warnings". Example: removing eggs from a cake reduces its rise and makes it denser.
- NEVER claim a substitute is equivalent when it is not. Describe the trade-off plainly.
- Only change what the task requires. Keep untouched ingredients and steps exactly as they are.
- Rewrite instruction steps so they match the new ingredients and quantities. Keep them numbered (1., 2., ...).
- Update tags to reflect the adaptation (e.g. add "Vegan" when made vegan; remove tags that no longer apply).
- If the cook time, difficulty, or servings genuinely change, update them; otherwise keep the originals.
- Preserve any "Source:" attribution line that appears in the original instructions — copy it into your instructions verbatim.

Return ONLY valid JSON (no markdown, no commentary) with this exact structure:
{
  "name": "adapted recipe name — keep it recognisable but note the change, e.g. 'Vegan Spaghetti Carbonara'",
  "description": "1-2 sentence description",
  "cuisine": "cuisine type",
  "cook_time_minutes": 30,
  "servings": 4,
  "difficulty": 1,
  "instructions": "Numbered step-by-step instructions as a single string (1., 2., ...).",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit of measure", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
  ],
  "tags": ["tag1", "tag2"],
  "warnings": ["Each material change the cook should know about, in plain language. Empty array if genuinely none."],
  "substitution_notes": ["Each swap you made and how it affects the dish, e.g. 'Butter → olive oil: less rich, slightly softer crumb.' Empty array if nothing was substituted."]
}`
}

/**
 * Ask Claude to produce an adapted recipe draft. The result is a preview the
 * caller reviews and saves as a NEW variant — it never mutates the original.
 */
export async function adaptRecipe(recipe: AdaptRecipeInput, opts: AdaptOptions): Promise<AdaptedRecipeDraft> {
  const currentServings = recipe.servings || 4
  const prompt = buildPrompt(recipe, opts, currentServings)

  const message = await anthropic.messages.create({
    model: pickModel(opts.adaptation_type),
    max_tokens: 3072,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected AI response')

  const parsed = extractJsonObject(content.text) as Record<string, unknown>

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : `${recipe.name} (adapted)`,
    description: typeof parsed.description === 'string' ? parsed.description : recipe.description ?? undefined,
    cuisine: typeof parsed.cuisine === 'string' ? parsed.cuisine : recipe.cuisine ?? undefined,
    cook_time_minutes: typeof parsed.cook_time_minutes === 'number'
      ? parsed.cook_time_minutes
      : recipe.cook_time_minutes ?? undefined,
    servings: typeof parsed.servings === 'number'
      ? parsed.servings
      : (opts.adaptation_type === 'portion_scaling' ? opts.target_servings : currentServings),
    difficulty: typeof parsed.difficulty === 'number' && parsed.difficulty >= 1 && parsed.difficulty <= 3
      ? parsed.difficulty
      : recipe.difficulty ?? undefined,
    instructions: typeof parsed.instructions === 'string' ? parsed.instructions : (recipe.instructions || ''),
    ingredients: Array.isArray(parsed.ingredients)
      ? (parsed.ingredients as Record<string, unknown>[]).map(i => ({
          name: String(i.name ?? ''),
          quantity: String(i.quantity ?? ''),
          unit: String(i.unit ?? ''),
          category: String(i.category ?? 'other'),
        })).filter(i => i.name)
      : [],
    tags: Array.isArray(parsed.tags) ? (parsed.tags as unknown[]).map(String) : (recipe.tags || []),
    warnings: Array.isArray(parsed.warnings) ? (parsed.warnings as unknown[]).map(String).filter(Boolean) : [],
    substitution_notes: Array.isArray(parsed.substitution_notes)
      ? (parsed.substitution_notes as unknown[]).map(String).filter(Boolean)
      : [],
    adaptation_type: opts.adaptation_type,
    user_request: (opts.request || '').trim() || buildTask(opts, currentServings),
    created_from_recipe_id: recipe.id,
    created_from_name: recipe.name,
  }
}
