/** The fixed vocabulary for `recipes.categories` — the library's "Type"
 *  filter. Unlike `recipe_type` (the course), a recipe can carry several.
 *  To add one, append it here and re-run scripts/backfill-recipe-categories.ts
 *  (with --all) so existing recipes pick it up. */
export const RECIPE_CATEGORIES = [
  { value: 'meat', label: 'Meat', hint: 'beef, pork, lamb, veal, game, sausage' },
  { value: 'poultry', label: 'Poultry', hint: 'chicken, turkey, duck' },
  { value: 'seafood', label: 'Seafood', hint: 'fish, shellfish, shrimp, squid' },
  { value: 'vegetable', label: 'Vegetable', hint: 'vegetables are the star of the dish, no meat or seafood' },
  { value: 'pasta', label: 'Pasta', hint: 'Italian-style pasta dishes, lasagna, gnocchi' },
  { value: 'rice', label: 'Rice', hint: 'rice-based dishes: fried rice, risotto, paella, rice bowls' },
  { value: 'noodles', label: 'Noodles', hint: 'Asian or other noodle dishes: ramen, pho, pad thai, lo mein' },
  { value: 'soup', label: 'Soup', hint: 'soups, stews, broths, chowders' },
  { value: 'salad', label: 'Salad', hint: 'salads of any kind' },
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]['value']
export const RECIPE_CATEGORY_VALUES: readonly RecipeCategory[] = RECIPE_CATEGORIES.map(c => c.value)

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return RECIPE_CATEGORY_VALUES.includes(value as RecipeCategory)
}
