import { getRecipes } from '@/lib/db/recipes'
import RecipeLibrary from '@/components/recipe-library'

export default async function RecipesPage() {
  const recipes = await getRecipes()
  return <RecipeLibrary initialRecipes={recipes} />
}
