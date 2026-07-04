import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cooked_at } = await request.json()
    if (!cooked_at) return NextResponse.json({ error: 'cooked_at is required' }, { status: 400 })

    const { error: updateError } = await supabase
      .from('cooking_log')
      .update({ cooked_at })
      .eq('id', logId)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Recalculate last_cooked_at from all logs for this recipe
    const { data: allLogs } = await supabase
      .from('cooking_log')
      .select('cooked_at')
      .eq('recipe_id', id)
      .eq('user_id', user.id)
      .order('cooked_at', { ascending: false })

    await supabase
      .from('recipes')
      .update({ last_cooked_at: allLogs?.[0]?.cooked_at ?? null })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error: deleteError } = await supabase
      .from('cooking_log')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    // Recalculate cooked_count and last_cooked_at from remaining logs
    const { data: remaining } = await supabase
      .from('cooking_log')
      .select('cooked_at')
      .eq('recipe_id', id)
      .eq('user_id', user.id)
      .order('cooked_at', { ascending: false })

    await supabase
      .from('recipes')
      .update({
        cooked_count: remaining?.length ?? 0,
        last_cooked_at: remaining?.[0]?.cooked_at ?? null,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
