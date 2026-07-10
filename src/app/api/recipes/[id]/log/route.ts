import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateSkillProfile } from '@/lib/db/profile'
import { emitActivity } from '@/lib/db/activity'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notes, cooked_at } = await request.json()

    await supabase.from('cooking_log').insert({
      recipe_id: id,
      user_id: user.id,
      notes,
      cooked_at: cooked_at || new Date().toISOString(),
    })

    const { data: recipe } = await supabase.from('recipes').select('cooked_count, techniques').eq('id', id).single()
    await supabase.from('recipes').update({
      cooked_count: (recipe?.cooked_count ?? 0) + 1,
      last_cooked_at: cooked_at || new Date().toISOString(),
    }).eq('id', id)

    if (recipe?.techniques?.length) {
      await updateSkillProfile(user.id, { newMasteredKeys: recipe.techniques })
    }

    await emitActivity('recipe_cooked', { recipe_id: id })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
