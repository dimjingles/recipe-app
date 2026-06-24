import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { ingredients, ...recipeData } = body

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ ...recipeData, user_id: user.id })
      .select()
      .single()

    if (recipeError) throw recipeError

    if (ingredients && ingredients.length > 0) {
      const { error: ingError } = await supabase
        .from('ingredients')
        .insert(ingredients.map((i: any) => ({ ...i, recipe_id: recipe.id })))
      if (ingError) throw ingError
    }

    return NextResponse.json(recipe)
  } catch (error: any) {
    console.error('Create recipe error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create recipe' }, { status: 500 })
  }
}
