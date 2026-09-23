import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { after } from 'next/server'
import { classifyRecipeLabels } from '@/lib/ai/classify-recipe-labels'
import { enrichRecipe } from '@/lib/ai/enrich-recipe'
import { emitActivity } from '@/lib/db/activity'
import { getRecipes } from '@/lib/db/recipes'
import { rehostImage } from '@/lib/images/rehost'

// The user's recipe library, same shape the pages render.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await getRecipes())
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch recipes' }, { status: 500 })
  }
}

// Covers the post-response enrichment scheduled with after().
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    // hero_image_url: a third-party photo (e.g. the search pick) to re-host into
    // our storage and attach as the first gallery image — done here, alongside
    // the other work, instead of as a separate request after the save.
    const { ingredients, hero_image_url, ...recipeData } = body

    if (!recipeData.instructions?.trim()) {
      return NextResponse.json({ error: 'Instructions are required' }, { status: 400 })
    }

    // Course + categories are needed as soon as the recipe shows up: the course
    // decides which pool it's ranked in, categories drive the library's "Type"
    // filter. The photo/dish-name extractors supply both; import, manual entry
    // and adaptation don't. One small Haiku call, started now so it overlaps
    // the database writes.
    const labelsPromise = classifyRecipeLabels(
      {
        name: recipeData.name,
        description: recipeData.description,
        instructions: recipeData.instructions,
        ingredientNames: (ingredients ?? []).map((i: any) => i.name),
      },
      { type: !recipeData.recipe_type, categories: !recipeData.categories?.length },
    )

    const heroPromise: Promise<string | null> =
      typeof hero_image_url === 'string' && hero_image_url.trim()
        ? rehostImage(supabase, user.id, hero_image_url.trim()).then(url => url ?? hero_image_url.trim())
        : Promise.resolve(null)

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ ...recipeData, user_id: user.id })
      .select()
      .single()

    if (recipeError) throw recipeError

    const [, ingResult, labels, heroUrl] = await Promise.all([
      emitActivity('recipe_created', { recipe_id: recipe.id }),
      ingredients && ingredients.length > 0
        ? supabase
            .from('ingredients')
            .insert(ingredients.map((i: any) => ({ ...i, recipe_id: recipe.id })))
        : Promise.resolve({ error: null }),
      labelsPromise,
      heroPromise,
    ])
    if (ingResult.error) throw ingResult.error

    const followUp = {
      ...(labels.recipe_type ? { recipe_type: labels.recipe_type } : {}),
      ...(labels.categories?.length ? { categories: labels.categories } : {}),
      ...(heroUrl ? { gallery_images: [heroUrl, ...(recipe.gallery_images ?? [])] } : {}),
    }
    if (Object.keys(followUp).length) {
      await supabase.from('recipes').update(followUp).eq('id', recipe.id).eq('user_id', user.id)
      Object.assign(recipe, followUp)
    }

    // Techniques and structured steps aren't needed to show the recipe — the
    // detail page splits plain instructions itself until steps exist — so
    // they're filled in after the response instead of holding up the save.
    after(() => enrichRecipe(recipe.id, user.id, recipeData.name, recipeData.instructions, recipeData.techniques))

    return NextResponse.json(recipe)
  } catch (error: any) {
    console.error('Create recipe error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create recipe' }, { status: 500 })
  }
}
