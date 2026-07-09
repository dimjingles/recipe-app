import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// The current user's ranked recipes (from recipe_rankings), used by the
// head-to-head comparison dialog.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('recipe_rankings')
      .select('rank, recipe:recipes(id, name, cuisine)')
      .eq('user_id', user.id)
      .order('rank', { ascending: true })

    if (error) throw error

    const flat = (data ?? [])
      .map((r: any) => r.recipe && ({ id: r.recipe.id, name: r.recipe.name, cuisine: r.recipe.cuisine, rank: r.rank }))
      .filter(Boolean)
    return NextResponse.json(flat)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
