import type { Profile, Recipe, Ingredient, SkillProfile } from '@/types/database'

// ── Recipe shape used for scoring ─────────────────────────────────────────────
// The planner receives recipes with their ingredients + cookbook memberships
// (see getRecipes()), so we can inspect ingredient names for allergen/diet checks.
export type ScorableRecipe = Recipe & {
  ingredients?: Pick<Ingredient, 'name'>[]
  cookbook_recipes?: { cookbook_id: string }[]
}

/** Fri, Sat, Sun bias toward "something special"; Mon–Thu are quick weeknights. */
export function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek >= 4
}

/** Normalise a cuisine string so 'Middle Eastern' and 'middle_eastern' match. */
export function normCuisine(cuisine?: string | null): string {
  return (cuisine || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ── Allergen / diet keyword corpora ──────────────────────────────────────────
// Keyed by the onboarding allergy `value`. Matched (case-insensitive substring)
// against a recipe's name, cuisine, tags, and ingredient names.
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: ['gluten', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'barley', 'rye', 'cracker', 'breadcrumb', 'couscous', 'tortilla'],
  dairy: ['dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'parmesan', 'mozzarella', 'ghee', 'ricotta'],
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'peanut', 'nut'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari'],
  eggs: ['egg', 'mayonnaise', 'mayo', 'meringue', 'omelette', 'omelet'],
  soy: ['soy', 'tofu', 'edamame', 'miso', 'tempeh', 'soybean', 'soya'],
  meat: ['beef', 'pork', 'chicken', 'lamb', 'bacon', 'ham', 'sausage', 'turkey', 'veal', 'steak', 'mince', 'chorizo', 'prosciutto', 'meat'],
}

const MEAT_KEYWORDS = ALLERGEN_KEYWORDS.meat
const SEAFOOD_KEYWORDS = [...ALLERGEN_KEYWORDS.shellfish, 'fish', 'salmon', 'tuna', 'cod', 'anchovy', 'sardine', 'trout', 'seafood']
const ANIMAL_KEYWORDS = [...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS, ...ALLERGEN_KEYWORDS.dairy, ...ALLERGEN_KEYWORDS.eggs, 'honey', 'gelatin', 'gelatine']

function recipeCorpus(recipe: ScorableRecipe): string {
  return [
    recipe.name,
    recipe.cuisine,
    ...(recipe.tags || []),
    ...(recipe.ingredients?.map(i => i.name) || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function hasTag(recipe: ScorableRecipe, tag: string): boolean {
  return (recipe.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())
}

/**
 * Detect diet / allergy conflicts. Returns human-readable labels (e.g.
 * "Contains dairy", "Not vegan"). Empty array = no known conflict.
 * The app informs — it never hides these recipes.
 */
export function detectConflicts(recipe: ScorableRecipe, profile: Profile | null): string[] {
  if (!profile) return []
  const corpus = recipeCorpus(recipe)
  const conflicts: string[] = []
  const matches = (words: string[]) => words.some(w => corpus.includes(w))

  // Allergies
  const allergies = (profile.allergies || []).filter(a => a && a !== 'none')
  for (const allergy of allergies) {
    const keywords = ALLERGEN_KEYWORDS[allergy]
    if (keywords && matches(keywords)) {
      conflicts.push(`Contains ${allergy}`)
    }
  }

  // Diet
  const diet = profile.diet
  const isVegan = hasTag(recipe, 'Vegan')
  const isVegetarianTagged = isVegan || hasTag(recipe, 'Vegetarian')
  if (diet === 'vegan' && !isVegan && matches(ANIMAL_KEYWORDS)) {
    conflicts.push('Not vegan')
  } else if (diet === 'vegetarian' && !isVegetarianTagged && matches([...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS])) {
    conflicts.push('Not vegetarian')
  } else if (diet === 'pescatarian' && !isVegetarianTagged && matches(MEAT_KEYWORDS)) {
    conflicts.push('Contains meat')
  }

  return conflicts
}

// ── Relevance scoring ─────────────────────────────────────────────────────────
export interface PlanScoringContext {
  profile: Profile | null
  skill: SkillProfile
  /** Target day, 0 = Monday … 6 = Sunday. */
  dayOfWeek: number
  /** Normalised-cuisine → count across the current week (excluding the target slot). */
  weekCuisineCounts: Record<string, number>
  /** Cookbook ids whose name reads like a weeknight collection. */
  weekdayCookbookIds: Set<string>
  /** Cookbook ids whose name reads like a weekend / project collection. */
  weekendCookbookIds: Set<string>
  /** Epoch ms "now" — injectable for testing; defaults to Date.now(). */
  now?: number
}

export interface RecipeScore {
  score: number
  /** Diet / allergy conflict labels (recipe should be de-emphasised). */
  conflicts: string[]
  /** Positive badge labels for the picker chips. */
  badges: string[]
}

function daysSince(iso: string | null, now: number): number {
  if (!iso) return Infinity
  return (now - new Date(iso).getTime()) / 86_400_000
}

/**
 * Pure relevance score for a recipe in a given day/plan context.
 * Higher = more relevant. See features/08 Slice 1 for the weighting rationale.
 */
export function scoreRecipe(recipe: ScorableRecipe, ctx: PlanScoringContext): RecipeScore {
  const now = ctx.now ?? Date.now()
  const weekend = isWeekend(ctx.dayOfWeek)
  const badges: string[] = []
  let score = 0

  const cuisineKey = normCuisine(recipe.cuisine)
  const favourites = new Set((ctx.profile?.favorite_cuisines || []).map(normCuisine))
  if (cuisineKey && favourites.has(cuisineKey)) {
    score += 50
    badges.push('Favourite cuisine')
  }

  const difficulty = recipe.difficulty ?? null
  const ceiling = ctx.skill.difficulty_ceiling
  if (difficulty != null && difficulty <= ceiling) score += 30
  if (difficulty != null && difficulty > ceiling) score -= 10

  const quickTagged = hasTag(recipe, 'Quick')
  if (quickTagged) {
    badges.push('Quick')
    if (!weekend) score += 20
  }

  if (recipe.cooked_count > 0) {
    score += 10
    badges.push('Cooked before')
  }

  const cookbookIds = weekend ? ctx.weekendCookbookIds : ctx.weekdayCookbookIds
  if (recipe.cookbook_recipes?.some(cr => cookbookIds.has(cr.cookbook_id))) {
    score += 5
  }

  if (daysSince(recipe.last_cooked_at, now) <= 7) {
    score -= 20
  }

  if (cuisineKey && (ctx.weekCuisineCounts[cuisineKey] || 0) >= 2) {
    score -= 15
  }

  const conflicts = detectConflicts(recipe, ctx.profile)
  if (conflicts.length) score -= 40

  return { score, conflicts, badges }
}

/**
 * Build normalised-cuisine → count from the current week's assigned recipes.
 * Optionally exclude one day (the slot being (re)assigned) so a recipe isn't
 * penalised for a cuisine it is itself about to replace.
 */
export function weekCuisineCounts(
  slots: { day_of_week: number; recipe?: { cuisine?: string | null } | null }[],
  excludeDay?: number
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const slot of slots) {
    if (excludeDay != null && slot.day_of_week === excludeDay) continue
    const key = normCuisine(slot.recipe?.cuisine)
    if (!key) continue
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}
