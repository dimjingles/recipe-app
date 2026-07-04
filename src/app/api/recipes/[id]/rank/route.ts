import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Load all currently ranked recipes for this user, ordered by rank
    const { data: ranked, error } = await supabase
      .from('recipes')
      .select('id, rank')
      .eq('user_id', user.id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })

    if (error) throw error

    // Remove this recipe from the list if it's already ranked (re-rank case)
    const others: { id: string; rank: number | null }[] = (ranked || []).filter(r => r.id !== id)

    // Splice this recipe in at the target position (clamp to valid range)
    const insertAt = Math.min(position - 1, others.length)
    others.splice(insertAt, 0, { id, rank: null })

    // Renumber 1..N and persist all changed rows
    const updates = others.map((r, i) => ({ id: r.id, rank: i + 1 }))
    for (const u of updates) {
      await supabase
        .from('recipes')
        .update({ rank: u.rank })
        .eq('id', u.id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true, rank: insertAt + 1 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
