// Text search over recipes the client already has (the library cache). Shared by
// the recipe library's search box and the /search page so both match the same
// way. Friends' recipes are searched server-side by the friend_recipes() RPC,
// which ranks name matches the same way.

/** The fields the matcher reads. */
export interface SearchableRecipe {
  name: string
  cuisine?: string | null
  tags?: string[] | null
  categories?: string[] | null
  ingredients?: { name: string }[] | null
}

/** Lower-case, trimmed, single-spaced — the form queries and names compare in. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * How well `recipe` matches `query`, lower is better; null when it doesn't match.
 *   0 name starts with the query
 *   1 a word in the name starts with it
 *   2 the name contains it
 *   3 cuisine, tag or category contains it
 *   4 an ingredient contains it
 * An empty query matches everything at 0.
 */
export function matchRecipe(recipe: SearchableRecipe, query: string): number | null {
  const q = normalizeQuery(query)
  if (!q) return 0
  const name = normalizeQuery(recipe.name)
  if (name.startsWith(q)) return 0
  if (name.includes(` ${q}`)) return 1
  if (name.includes(q)) return 2
  const meta = [recipe.cuisine, ...(recipe.tags ?? []), ...(recipe.categories ?? [])]
  if (meta.some(m => m?.toLowerCase().includes(q))) return 3
  if (recipe.ingredients?.some(i => i.name.toLowerCase().includes(q))) return 4
  return null
}

/** Recipes matching `query`, best match first (ties keep their input order). */
export function searchRecipes<T extends SearchableRecipe>(recipes: T[], query: string): T[] {
  return recipes
    .map((recipe, index) => ({ recipe, index, rank: matchRecipe(recipe, query) }))
    .filter((m): m is { recipe: T; index: number; rank: number } => m.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(m => m.recipe)
}

/** True when the recipe's name is exactly the query (ignoring case and spacing). */
export function isExactNameMatch(recipe: SearchableRecipe, query: string): boolean {
  const q = normalizeQuery(query)
  return !!q && normalizeQuery(recipe.name) === q
}
