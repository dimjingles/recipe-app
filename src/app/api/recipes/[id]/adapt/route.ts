import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecipe } from '@/lib/db/recipes'
import { adaptRecipe } from '@/lib/ai/adapt-recipe'
import type { AdaptationType } from '@/types/database'

const ADAPTATION_TYPES: AdaptationType[] = [
  'dietary_swap',
  'portion_scaling',
  'pantry_substitution',
  'freeform',
]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const adaptation_type = body.adaptation_type as AdaptationType
    const userRequest = typeof body.request === 'string' ? body.request.trim() : ''
    const targetServings = typeof body.target_servings === 'number' ? body.target_servings : undefined
    const missingIngredients = Array.isArray(body.missing_ingredients)
      ? body.missing_ingredients.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
      : undefined

    if (!ADAPTATION_TYPES.includes(adaptation_type)) {
      return NextResponse.json({ error: 'Invalid adaptation_type' }, { status: 400 })
    }
    if (adaptation_type === 'portion_scaling') {
      if (!targetServings || targetServings < 1) {
        return NextResponse.json({ error: 'target_servings is required for portion scaling' }, { status: 400 })
      }
    } else if (adaptation_type === 'pantry_substitution') {
      if ((!missingIngredients || missingIngredients.length === 0) && !userRequest) {
        return NextResponse.json({ error: 'missing_ingredients or request is required' }, { status: 400 })
      }
    } else if (!userRequest) {
      return NextResponse.json({ error: 'request is required' }, { status: 400 })
    }

    const recipe = await getRecipe(id)
    if (!recipe || recipe.user_id !== user.id) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const draft = await adaptRecipe(recipe, {
      adaptation_type,
      request: userRequest,
      target_servings: targetServings,
      missing_ingredients: missingIngredients,
    })

    return NextResponse.json(draft)
  } catch (error: unknown) {
    console.error('Recipe adapt error:', error)
    const err = error as { status?: number; message?: string }
    const msg = err?.status ? `AI error ${err.status}: ${err.message}` : (err?.message || 'Failed to adapt recipe')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
