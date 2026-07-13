import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient, getUser } from '@/lib/supabase/server'
import { getPublicProfile } from '@/lib/db/social'
import { RecipeCard } from '@/components/recipe-card'

// Read-only view of a friend's cookbook. Visibility is enforced entirely by RLS:
// the cookbook, its entries, and each recipe are only returned if visible to us,
// so private recipes inside a shared cookbook simply don't appear.
export default async function FriendCookbookPage({ params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect(`/login?next=/u/${username}/cookbooks/${id}`)

  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  const { data: cookbook } = await supabase
    .from('cookbooks')
    .select('*, cookbook_recipes(recipe:recipes(*))')
    .eq('id', id)
    .eq('user_id', profile.id)
    .maybeSingle()
  if (!cookbook) notFound()

  const cb = cookbook as any
  const recipes = (cb.cookbook_recipes || []).map((cr: any) => cr.recipe).filter(Boolean)

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-24">
      <div className="mb-5 flex items-center gap-3">
        <Link href={`/u/${username}`} className="p-1 -ml-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-bold text-foreground">{cb.name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username} · {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}</p>
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No visible recipes in this cookbook.</p>
      ) : (
        <div className="space-y-2">
          {recipes.map((r: any) => (
            <Link key={r.id} href={`/recipes/${r.id}`} className="block">
              <RecipeCard recipe={r} variant="list" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
