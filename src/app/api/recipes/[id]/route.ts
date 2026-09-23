import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { after } from 'next/server'
import { enrichRecipe } from '@/lib/ai/enrich-recipe'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'
import type { RecipeVariantLink } from '@/types/database'

export const maxDuration = 60

/**
 * One recipe for the detail page: the recipe with ingredients, cooking log,
 * cookbook memberships and the caller's personal rank, plus its adapted
 * variants. Visibility is RLS's call — a friend's recipe comes back read-only.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: recipe }, { data: ranking }, { data: variantRows }] = await Promise.all([
      supabase
        .from('recipes')
        .select('*, ingredients(*), cooking_log(*), cookbook_recipes(cookbook_id)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('recipe_rankings').select('rank').eq('user_id', user.id).eq('recipe_id', id).maybeSingle(),
      supabase
        .from('recipes')
        .select('id, name, cuisine, adaptation_metadata')
        .eq('original_recipe_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    const r = recipe as any
    // rank shown on the detail page is the CURRENT user's personal rank.
    r.rank = ranking?.rank ?? null
    const isOwner = r.user_id === user.id

    const variants: RecipeVariantLink[] = ((variantRows || []) as any[]).map(v => ({
      id: v.id,
      name: v.name,
      cuisine: v.cuisine,
      adaptation_type: v.adaptation_metadata?.adaptation_type ?? null,
    }))

    // Backfill techniques for recipes that predate classification (owner only).
    // An AI call, so it runs after the response — they appear on the next load.
    if (isOwner && !r.techniques?.length && r.instructions) {
      const name = r.name as string
      const instructions = r.instructions as string
      after(async () => {
        try {
          const classified = await classifyTechniques(name, instructions, await getTechniqueKeys())
          if (classified.length) {
            await supabase.from('recipes').update({ techniques: classified }).eq('id', id).eq('user_id', user.id)
          }
        } catch (e) {
          console.error('technique backfill failed:', e)
        }
      })
    }

    return NextResponse.json({ recipe: r, variants, isOwner })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
