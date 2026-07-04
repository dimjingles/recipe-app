import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('recipes')
      .select('cuisine')
      .eq('user_id', user.id)
      .not('cuisine', 'is', null)

    if (error) throw error

    const cuisines = Array.from(
      new Set((data || []).map(r => r.cuisine!.toLowerCase()).filter(Boolean))
    ).sort()

    return NextResponse.json(cuisines)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
