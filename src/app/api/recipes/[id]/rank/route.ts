import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TIER_ORDER, type Feedback } from '@/lib/scoring'

type Row = { id: string; rank: number | null; feedback: Feedback | null }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // `position` is the target slot WITHIN this recipe's own tier (1-based).
    const { position } = await request.json()
    if (typeof position !== 'number' || position < 1) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // This recipe's tier — it's only ranked against others in the same tier.
    const { data: self, error: selfErr } = await supabase
      .from('recipes')
      .select('feedback')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (selfErr) throw selfErr
    const selfTier: Feedback | null = (self?.feedback as Feedback | null) ?? null

    // All currently ranked recipes for this user, ordered by rank.
    const { data: ranked, error } = await supabase
      .from('recipes')
      .select('id, rank, feedback')
      .eq('user_id', user.id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })
    if (error) throw error

    const others = ((ranked || []) as Row[]).filter(r => r.id !== id)

    // Group into tiers, best first (like → okay → dislike), null feedback last.
    const tiers: (Feedback | null)[] = [...TIER_ORDER, null]
    const buckets = new Map<Feedback | null, Row[]>(tiers.map(t => [t, [] as Row[]]))
    for (const r of others) buckets.get(r.feedback ?? null)!.push(r)

    // Insert this recipe into its tier at the requested within-tier position.
    const selfBucket = buckets.get(selfTier)!
    const insertAt = Math.min(position - 1, selfBucket.length)
    selfBucket.splice(insertAt, 0, { id, rank: null, feedback: selfTier })

    // Flatten tier-major and renumber 1..N globally, persisting only changes.
    const ordered = tiers.flatMap(t => buckets.get(t)!)
    const oldRank = new Map((ranked || []).map(r => [r.id, r.rank]))
    let selfRank = insertAt + 1
    for (let i = 0; i < ordered.length; i++) {
      const newRank = i + 1
      if (ordered[i].id === id) selfRank = newRank
      if (oldRank.get(ordered[i].id) !== newRank) {
        await supabase
          .from('recipes')
          .update({ rank: newRank })
          .eq('id', ordered[i].id)
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json({ success: true, rank: selfRank, feedback: selfTier })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
