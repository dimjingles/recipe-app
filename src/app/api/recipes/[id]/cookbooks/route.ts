import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT /api/recipes/[id]/cookbooks
 * Body: { cookbook_ids: string[] }
 * Replaces all cookbook memberships for this recipe (for the current user's cookbooks).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recipeId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cookbook_ids = [] } = await request.json()

    // Get all cookbooks owned by this user
    const { data: userCookbooks } = await supabase
      .from('cookbooks')
      .select('id')
      .eq('user_id', user.id)

    const userCookbookIds = (userCookbooks || []).map((c: { id: string }) => c.id)

    // Remove this recipe from all the user's cookbooks
    if (userCookbookIds.length > 0) {
      await supabase
        .from('cookbook_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .in('cookbook_id', userCookbookIds)
    }

    // Re-insert selected cookbooks (only from user-owned list for safety)
    const safeIds = cookbook_ids.filter((id: string) => userCookbookIds.includes(id))
    if (safeIds.length > 0) {
      const { error } = await supabase
        .from('cookbook_recipes')
        .insert(safeIds.map((cookbook_id: string) => ({ cookbook_id, recipe_id: recipeId })))
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update cookbooks' }, { status: 500 })
  }
}
