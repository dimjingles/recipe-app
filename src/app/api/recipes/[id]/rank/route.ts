import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Writes ONLY the current user's ranking (recipe_rankings). Household members
// each keep their own order for the same recipe; this never touches theirs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { position } = await request.json()
    if (typeof position !== 'number' || position < 1) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // The current user's existing rankings, in order.
    const { data: rankings, error } = await supabase
      .from('recipe_rankings')
      .select('recipe_id, rank')
      .eq('user_id', user.id)
      .order('rank', { ascending: true })
    if (error) throw error

    const others = (rankings ?? []).filter(r => r.recipe_id !== id)
    const insertAt = Math.min(position - 1, others.length)
    others.splice(insertAt, 0, { recipe_id: id, rank: 0 })

    // Renumber 1..N and persist in one statement — the unique(user_id, rank)
    // constraint is DEFERRABLE INITIALLY DEFERRED, so intermediate collisions
    // within the statement are fine.
    const now = new Date().toISOString()
    const rows = others.map((r, i) => ({ user_id: user.id, recipe_id: r.recipe_id, rank: i + 1, updated_at: now }))
    const { error: upErr } = await supabase
      .from('recipe_rankings')
      .upsert(rows, { onConflict: 'user_id,recipe_id' })
    if (upErr) throw upErr

    return NextResponse.json({ success: true, rank: insertAt + 1 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
