import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { TIER_ORDER, rankGroup, poolInsertIndex, type Feedback, type RankGroup } from '@/lib/scoring'

type Row = { recipe_id: string; rank: number; feedback: Feedback | null; group: RankGroup }

// Writes ONLY the current user's ranking (recipe_rankings).
// Recipes are ranked WITHIN their pool — the like/okay/dislike tier
// (recipes.feedback) AND the recipe type (main / dessert / drink / other).
// The stored rank is still a single global tier-major ordinal; only its order
// within a pool carries meaning.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // `position` is the target slot WITHIN this recipe's own pool (1-based).
    const { position } = await request.json()
    if (typeof position !== 'number' || position < 1) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const [
      // This recipe's pool (feedback + type live on the recipe; RLS gates readability).
      { data: self, error: selfErr },
      // The current user's existing rankings, with each recipe's tier and type.
      { data: rankings, error },
    ] = await Promise.all([
      supabase
        .from('recipes')
        .select('feedback, recipe_type')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('recipe_rankings')
        .select('recipe_id, rank, recipe:recipes(feedback, recipe_type)')
        .eq('user_id', user.id)
        .order('rank', { ascending: true }),
    ])
    if (selfErr) throw selfErr
    if (error) throw error
    const selfTier: Feedback | null = (self?.feedback as Feedback | null) ?? null
    const selfGroup = rankGroup(self?.recipe_type as string | null | undefined)

    const others: Row[] = (rankings ?? [])
      .filter((r: any) => r.recipe_id !== id)
      .map((r: any) => ({
        recipe_id: r.recipe_id,
        rank: r.rank,
        feedback: r.recipe?.feedback ?? null,
        group: rankGroup(r.recipe?.recipe_type),
      }))

    // Group into tiers, best first (like → okay → dislike), null feedback last.
    const tiers: (Feedback | null)[] = [...TIER_ORDER, null]
    const buckets = new Map<Feedback | null, Row[]>(tiers.map(t => [t, [] as Row[]]))
    for (const r of others) buckets.get(r.feedback ?? null)!.push(r)

    // Insert into this recipe's tier at the flat index that lands it in the
    // requested slot of its OWN pool. Recipes of other types keep their relative
    // order untouched, so re-ranking a dessert never reshuffles the mains.
    const selfBucket = buckets.get(selfTier)!
    const insertAt = poolInsertIndex(selfBucket.map(r => r.group), selfGroup, position)
    selfBucket.splice(insertAt, 0, { recipe_id: id, rank: 0, feedback: selfTier, group: selfGroup })

    // Flatten tier-major and renumber 1..N globally, then persist in one
    // statement — the unique(user_id, rank) constraint is DEFERRABLE INITIALLY
    // DEFERRED, so intermediate collisions within the statement are fine.
    const ordered = tiers.flatMap(t => buckets.get(t)!)
    const now = new Date().toISOString()
    // Only rows whose rank actually moved (plus this recipe) — a comparison
    // usually shifts a handful of neighbours, not the whole list.
    const oldRank = new Map((rankings ?? []).map((r: any) => [r.recipe_id as string, r.rank as number]))
    const rows = ordered
      .map((r, i) => ({ user_id: user.id, recipe_id: r.recipe_id, rank: i + 1, updated_at: now }))
      .filter(r => r.recipe_id === id || oldRank.get(r.recipe_id) !== r.rank)
    const { error: upErr } = await supabase
      .from('recipe_rankings')
      .upsert(rows, { onConflict: 'user_id,recipe_id' })
    if (upErr) throw upErr

    const selfRank = ordered.findIndex(r => r.recipe_id === id) + 1
    return NextResponse.json({ success: true, rank: selfRank, feedback: selfTier })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
