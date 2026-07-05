import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('cookbooks')
      .select('*, cookbook_recipes(recipe_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch cookbooks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, recipe_ids = [] } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data: cookbook, error: cbError } = await supabase
      .from('cookbooks')
      .insert({ user_id: user.id, name: name.trim() })
      .select()
      .single()

    if (cbError) throw cbError

    if (recipe_ids.length > 0) {
      const { error: joinError } = await supabase
        .from('cookbook_recipes')
        .insert(recipe_ids.map((recipe_id: string) => ({ cookbook_id: cookbook.id, recipe_id })))
      if (joinError) throw joinError
    }

    return NextResponse.json(cookbook)
  } catch (error: any) {
    console.error('Create cookbook error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create cookbook' }, { status: 500 })
  }
}
