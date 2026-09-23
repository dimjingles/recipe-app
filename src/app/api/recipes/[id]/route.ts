import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { after } from 'next/server'
import { enrichRecipe } from '@/lib/ai/enrich-recipe'

export const maxDuration = 60

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { ingredients, ...recipeData } = body
    let reEnrich = false
    if ('instructions' in recipeData) {
      if (!recipeData.instructions?.trim()) {
        return NextResponse.json({ error: 'Instructions are required' }, { status: 400 })
      }
      // The edit form always sends instructions. Only re-derive techniques and
      // steps when they actually changed — a title or tag edit shouldn't cost
      // two AI calls.
      const { data: current } = await supabase
        .from('recipes')
        .select('instructions')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (current?.instructions === recipeData.instructions) {
        delete recipeData.instructions
      } else {
        reEnrich = true
        // Old steps no longer match the text; the page splits the new text
        // itself until enrichRecipe (below) stores fresh steps.
        if (!('instruction_steps' in recipeData)) recipeData.instruction_steps = null
      }
    }

    const { data: recipe, error } = await supabase
      .from('recipes')
      .update(recipeData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error

    if (ingredients !== undefined) {
      const { error: delError } = await supabase.from('ingredients').delete().eq('recipe_id', id)
      if (delError) throw delError
      if (ingredients.length > 0) {
        const { error: insError } = await supabase.from('ingredients').insert(
          ingredients.map((i: any) => ({ ...i, recipe_id: id }))
        )
        if (insError) throw insError
      }
    }

    if (reEnrich) {
      after(() => enrichRecipe(id, user.id, recipe.name, recipe.instructions!, recipeData.techniques))
    }

    return NextResponse.json(recipe)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('recipes').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
