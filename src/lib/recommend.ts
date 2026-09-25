import type { Profile } from '@/types/database'
import { computeScores, isFeedback } from './scoring'
import { detectConflicts, normCuisine, type ScorableRecipe } from './planner-scoring'
import { normalizeQuery } from './recipe-search'

// "Recipes we think you'll like": friends' recipes that resemble the ones the
// user rated well. Deterministic feature overlap, no AI call — the taste profile
// comes from the user's own ratings (friends' recipes can't be liked directly).

/** One of the user's own recipes, as the taste profile reads it. */
export interface TasteRecipe {
  id: string
  name: string
  cuisine: string | null
  categories: string[] | null
  tags: string[] | null
  feedback: string | null
  rank: number | null
  recipe_type: string | null
  cooked_count: number | null
}

/** A friend's recipe, as the friend_recipes() RPC returns it. */
export interface FriendRecipeCandidate {
  id: string
  user_id: string
  name: string
  cuisine: string | null
  categories: string[] | null
  tags: string[] | null
  feedback: string | null
  cooked_count: number | null
  original_recipe_id: string | null
  created_at: string
  ingredient_names: string[]
}

// Cuisine says the most about taste; categories (meat, pasta, soup, …) next.
// Tags are sparse — AI-created recipes save none — so they only nudge.
// recipe_type is left out: nearly everything is a main.
const FEATURE_WEIGHT = { cuisine: 3, category: 2, tag: 0.5 }
// Unranked recipes that still carry a verdict.
const FEEDBACK_WEIGHT = { like: 0.8, okay: 0.1, dislike: -0.8 }
// The friend's own verdict and cooking history are a quality signal.
const FRIEND_LIKED_BOOST = 0.5
const FRIEND_COOKED_BOOST = 0.2
const MAX_PER_FRIEND = 2
const MAX_PER_CUISINE = 3

type Featured = Pick<TasteRecipe, 'cuisine' | 'categories' | 'tags'>

function features(recipe: Featured): Map<string, number> {
  const f = new Map<string, number>()
  const cuisine = normCuisine(recipe.cuisine)
  if (cuisine) f.set(`cuisine:${cuisine}`, FEATURE_WEIGHT.cuisine)
  for (const c of recipe.categories ?? []) if (c) f.set(`category:${c.toLowerCase()}`, FEATURE_WEIGHT.category)
  for (const t of recipe.tags ?? []) if (t) f.set(`tag:${t.toLowerCase()}`, FEATURE_WEIGHT.tag)
  return f
}

/**
 * How strongly one of the user's recipes speaks for their taste, −1…1. Ranked
 * recipes use their 0–10 score (liked ≈ +1, disliked ≈ −1); unranked ones their
 * verdict; unrated ones a little for each time they cooked it.
 */
export function tasteWeight(recipe: TasteRecipe, score: number | undefined): number {
  if (score !== undefined) return (score - 5) / 5
  if (isFeedback(recipe.feedback)) return FEEDBACK_WEIGHT[recipe.feedback]
  return Math.min(1, 0.3 * Math.log1p(recipe.cooked_count ?? 0))
}

/** Feature → affinity, averaged over the evidence so values stay near −3…3. */
export function buildTasteProfile(mine: TasteRecipe[]): Map<string, number> {
  const scores = computeScores(
    mine.map(r => ({
      id: r.id,
      rank: r.rank,
      feedback: isFeedback(r.feedback) ? r.feedback : null,
      recipeType: r.recipe_type,
    })),
  )
  const taste = new Map<string, number>()
  let evidence = 0
  for (const r of mine) {
    const w = tasteWeight(r, scores[r.id])
    if (!w) continue
    evidence += Math.abs(w)
    for (const [key, fw] of features(r)) taste.set(key, (taste.get(key) ?? 0) + w * fw)
  }
  if (evidence > 0) for (const [key, v] of taste) taste.set(key, v / evidence)
  return taste
}

/**
 * Up to `limit` friends' recipes, most similar first. Skips recipes the friend
 * disliked, ones the user already has (same name, or adapted from theirs), and
 * ones that clash with the user's allergies or diet. At most two per friend and
 * three per cuisine while there's enough to choose from. With no taste signal it
 * degrades to friends' liked-and-newest recipes.
 */
export function recommendFromFriends<T extends FriendRecipeCandidate>(
  mine: TasteRecipe[],
  candidates: T[],
  profile: Profile | null,
  limit = 10,
): T[] {
  const taste = buildTasteProfile(mine)
  const myNames = new Set(mine.map(r => normalizeQuery(r.name)))
  const myIds = new Set(mine.map(r => r.id))

  const eligible = candidates.filter(c =>
    c.feedback !== 'dislike' &&
    !myNames.has(normalizeQuery(c.name)) &&
    !(c.original_recipe_id && myIds.has(c.original_recipe_id)) &&
    detectConflicts(
      { name: c.name, cuisine: c.cuisine, tags: c.tags, ingredients: c.ingredient_names.map(name => ({ name })) } as ScorableRecipe,
      profile,
    ).length === 0,
  )

  // Down-weight features most candidates share (IDF), so "main"-like categories
  // that everyone cooks don't drown out the distinctive ones.
  const candidateFeatures = eligible.map(c => features(c))
  const df = new Map<string, number>()
  for (const f of candidateFeatures) for (const key of f.keys()) df.set(key, (df.get(key) ?? 0) + 1)
  const idf = (key: string) => Math.log(1 + eligible.length / (1 + (df.get(key) ?? 0)))

  const scored = eligible.map((c, i) => {
    let score = 0
    for (const key of candidateFeatures[i].keys()) score += (taste.get(key) ?? 0) * idf(key)
    if (c.feedback === 'like') score += FRIEND_LIKED_BOOST
    if ((c.cooked_count ?? 0) > 0) score += FRIEND_COOKED_BOOST
    return { c, score, time: Date.parse(c.created_at) || 0 }
  })
  // Anything that leans toward what the user dislikes stays out.
  const ranked = scored
    .filter(s => s.score >= 0)
    .sort((a, b) => b.score - a.score || b.time - a.time)

  const picked: T[] = []
  const perFriend = new Map<string, number>()
  const perCuisine = new Map<string, number>()
  for (const { c } of ranked) {
    if (picked.length >= limit) break
    const cuisine = normCuisine(c.cuisine)
    if ((perFriend.get(c.user_id) ?? 0) >= MAX_PER_FRIEND) continue
    if (cuisine && (perCuisine.get(cuisine) ?? 0) >= MAX_PER_CUISINE) continue
    picked.push(c)
    perFriend.set(c.user_id, (perFriend.get(c.user_id) ?? 0) + 1)
    if (cuisine) perCuisine.set(cuisine, (perCuisine.get(cuisine) ?? 0) + 1)
  }
  // Few friends or one-cuisine pools: top up past the variety caps.
  if (picked.length < limit) {
    const chosen = new Set(picked.map(c => c.id))
    for (const { c } of ranked) {
      if (picked.length >= limit) break
      if (!chosen.has(c.id)) picked.push(c)
    }
  }
  return picked
}
