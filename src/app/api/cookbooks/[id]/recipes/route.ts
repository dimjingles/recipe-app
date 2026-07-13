import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'

// Verify the user owns this cookbook
async function verifyCookbookOwnership(supabase: Awaited<ReturnType<typeof createClient>>, cookbookId: string, userId: string) {
  const { data } = await supabase
    .from('cookbooks')
    .select('id')
    .eq('id', cookbookId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cookbookId } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await verifyCookbookOwnership(supabase, cookbookId, user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { recipe_id } = await request.json()
    if (!recipe_id) return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })

    const { error } = await supabase
      .from('cookbook_recipes')
      .insert({ cookbook_id: cookbookId, recipe_id })

    if (error && error.code !== '23505') throw error // ignore unique-violation (already member)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add recipe' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cookbookId } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await verifyCookbookOwnership(supabase, cookbookId, user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { recipe_id } = await request.json()
    if (!recipe_id) return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })

    const { error } = await supabase
      .from('cookbook_recipes')
      .delete()
      .eq('cookbook_id', cookbookId)
      .eq('recipe_id', recipe_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove recipe' }, { status: 500 })
  }
}
