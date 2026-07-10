import { getRecipes } from '@/lib/db/recipes'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getMyHouseholdId } from '@/lib/db/households'
import { getProfile } from '@/lib/db/profile'
import RecipeLibrary from '@/components/recipe-library'

export default async function RecipesPage() {
  const [recipes, cookbooks, householdId, profile] = await Promise.all([
    getRecipes(),
    getCookbooks(),
    getMyHouseholdId(),
    getProfile(),
  ])
  return (
    <RecipeLibrary
      initialRecipes={recipes}
      initialCookbooks={cookbooks}
      hasHousehold={!!householdId}
      initialSortPreference={profile?.recipe_sort_preference ?? 'ranking'}
    />
  )
}
