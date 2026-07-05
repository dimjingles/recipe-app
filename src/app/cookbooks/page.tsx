import { getCookbooks } from '@/lib/db/cookbooks'
import { getRecipes } from '@/lib/db/recipes'
import CookbooksView from '@/components/cookbooks-view'

export default async function CookbooksPage() {
  const [cookbooks, recipes] = await Promise.all([getCookbooks(), getRecipes()])
  return <CookbooksView initialCookbooks={cookbooks} initialRecipes={recipes} />
}
