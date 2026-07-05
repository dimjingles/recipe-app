import { getRecipes } from '@/lib/db/recipes'
import { getCookbooks } from '@/lib/db/cookbooks'
import RecipeLibrary from '@/components/recipe-library'

export default async function RecipesPage() {
  const [recipes, cookbooks] = await Promise.all([getRecipes(), getCookbooks()])
  return <RecipeLibrary initialRecipes={recipes} initialCookbooks={cookbooks} />
}
