import { getRecipes } from '@/lib/db/recipes'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getMyHouseholdId } from '@/lib/db/households'
import RecipeLibrary from '@/components/recipe-library'

export default async function RecipesPage() {
  const [recipes, cookbooks, householdId] = await Promise.all([
    getRecipes(),
    getCookbooks(),
    getMyHouseholdId(),
  ])
  return <RecipeLibrary initialRecipes={recipes} initialCookbooks={cookbooks} hasHousehold={!!householdId} />
}
