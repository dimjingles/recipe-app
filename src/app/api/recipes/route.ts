import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'
import { structureInstructions } from '@/lib/ai/structure-instructions'
import { emitActivity } from '@/lib/db/activity'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { ingredients, ...recipeData } = body

    if (!recipeData.instructions?.trim()) {
      return NextResponse.json({ error: 'Instructions are required' }, { status: 400 })
    }

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ ...recipeData, user_id: user.id })
      .select()
      .single()

    if (recipeError) throw recipeError

    await emitActivity('recipe_created', { recipe_id: recipe.id })

    if (ingredients && ingredients.length > 0) {
      const { error: ingError } = await supabase
        .from('ingredients')
        .insert(ingredients.map((i: any) => ({ ...i, recipe_id: recipe.id })))
      if (ingError) throw ingError
    }

    if (recipeData.instructions) {
      const [techniques, instruction_steps] = await Promise.all([
        recipeData.techniques?.length
          ? Promise.resolve(recipeData.techniques as string[])
          : getTechniqueKeys(supabase).then(keys =>
              classifyTechniques(recipeData.name, recipeData.instructions, keys)
            ),
        structureInstructions(recipeData.name, recipeData.instructions),
      ])
      if (techniques.length || instruction_steps.length) {
        const updatePayload = {
          ...(techniques.length ? { techniques } : {}),
          ...(instruction_steps.length ? { instruction_steps } : {}),
        }
        await supabase.from('recipes').update(updatePayload).eq('id', recipe.id).eq('user_id', user.id)
        if (techniques.length) recipe.techniques = techniques
        if (instruction_steps.length) recipe.instruction_steps = instruction_steps
      }
    }

    return NextResponse.json(recipe)
  } catch (error: any) {
    console.error('Create recipe error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create recipe' }, { status: 500 })
  }
}
