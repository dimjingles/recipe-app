import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// Owner-only: creates (or returns the existing) public share token for a recipe.
// A recipe with a share_token is viewable read-only at /share/<token> by anyone,
// no account required. The token is reused on repeat calls so the link is stable.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, user_id, share_token')
      .eq('id', id)
      .single()

    if (error || !recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (recipe.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let token = recipe.share_token
    if (!token) {
      token = crypto.randomUUID()
      // RLS still enforces owner-only update; the check above is for a clean 403.
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ share_token: token })
        .eq('id', id)
      if (updateError) throw updateError
    }

    return NextResponse.json({ token })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
