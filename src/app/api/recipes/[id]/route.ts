import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'
import { structureInstructions } from '@/lib/ai/structure-instructions'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { ingredients, ...recipeData } = body
    if ('instructions' in recipeData) {
      if (!recipeData.instructions?.trim()) {
        return NextResponse.json({ error: 'Instructions are required' }, { status: 400 })
      }
      const [techniques, instruction_steps] = await Promise.all([
        recipeData.techniques?.length
          ? Promise.resolve(recipeData.techniques as string[])
          : getTechniqueKeys(supabase).then(keys =>
              classifyTechniques(recipeData.name || 'Recipe', recipeData.instructions, keys)
            ),
        structureInstructions(recipeData.name || 'Recipe', recipeData.instructions),
      ])
      if (techniques.length) recipeData.techniques = techniques
      recipeData.instruction_steps = instruction_steps.length ? instruction_steps : null
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
      await supabase.from('ingredients').delete().eq('recipe_id', id)
      if (ingredients.length > 0) {
        await supabase.from('ingredients').insert(
          ingredients.map((i: any) => ({ ...i, recipe_id: id }))
        )
      }
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('recipes').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
