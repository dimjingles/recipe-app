import { getRecipes } from '@/lib/db/recipes'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getProfile } from '@/lib/db/profile'
import RecipeLibrary from '@/components/recipe-library'

export default async function RecipesPage() {
  const [recipes, cookbooks, profile] = await Promise.all([getRecipes(), getCookbooks(), getProfile()])
  return (
    <RecipeLibrary
      initialRecipes={recipes}
      initialCookbooks={cookbooks}
      initialSortPreference={profile?.recipe_sort_preference ?? 'ranking'}
    />
  )
}
