import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFeedback } from '@/lib/scoring'

// The current user's ranked recipes (from recipe_rankings), used by the
// head-to-head comparison dialog. An optional ?feedback= tier filter restricts
// to one like/okay/dislike band, since recipes are ranked only within their tier.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const feedback = request.nextUrl.searchParams.get('feedback')

    const { data, error } = await supabase
      .from('recipe_rankings')
      .select('rank, recipe:recipes(id, name, cuisine, feedback)')
      .eq('user_id', user.id)
      .order('rank', { ascending: true })
    if (error) throw error

    let rows = (data ?? []).filter((r: any) => r.recipe)
    if (isFeedback(feedback)) rows = rows.filter((r: any) => r.recipe.feedback === feedback)
    else if (feedback === 'none') rows = rows.filter((r: any) => r.recipe.feedback == null)

    const flat = rows.map((r: any) => ({
      id: r.recipe.id,
      name: r.recipe.name,
      cuisine: r.recipe.cuisine,
      rank: r.rank,
      feedback: r.recipe.feedback ?? null,
    }))
    return NextResponse.json(flat)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
