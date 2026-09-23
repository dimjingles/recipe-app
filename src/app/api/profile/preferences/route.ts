import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { updateRecipeSortPreference, updateRecipeTypeFilter } from '@/lib/db/profile'
import type { RecipeSortPreference, RecipeSortDirection, RecipeTypeFilter } from '@/types/database'

const RECIPE_SORT_PREFERENCES: RecipeSortPreference[] = ['ranking', 'recently_cooked', 'most_cooked', 'cook_time']
const RECIPE_SORT_DIRECTIONS: RecipeSortDirection[] = ['default', 'reversed']
const RECIPE_TYPE_FILTERS: RecipeTypeFilter[] = ['all', 'appetizer', 'main', 'dessert', 'drink']

function isRecipeSortPreference(value: unknown): value is RecipeSortPreference {
  return typeof value === 'string' && RECIPE_SORT_PREFERENCES.includes(value as RecipeSortPreference)
}

function isRecipeSortDirection(value: unknown): value is RecipeSortDirection {
  return typeof value === 'string' && RECIPE_SORT_DIRECTIONS.includes(value as RecipeSortDirection)
}

function isRecipeTypeFilter(value: unknown): value is RecipeTypeFilter {
  return typeof value === 'string' && RECIPE_TYPE_FILTERS.includes(value as RecipeTypeFilter)
}

// Patches library preferences. Each field is independent — the sort dropdown
// and the type filter save separately — but at least one must be present.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const hasSort = 'recipe_sort_preference' in body
    const hasTypeFilter = 'recipe_type_filter' in body

    if (!hasSort && !hasTypeFilter) {
      return NextResponse.json({ error: 'No preferences supplied' }, { status: 400 })
    }

    // Validate everything first, then write both fields together.
    const writes: Promise<unknown>[] = []
    if (hasSort) {
      if (!isRecipeSortPreference(body.recipe_sort_preference)) {
        return NextResponse.json({ error: 'Invalid recipe sort preference' }, { status: 400 })
      }
      // Direction is optional for backwards compatibility; default to top-to-bottom.
      const direction = body.recipe_sort_direction ?? 'default'
      if (!isRecipeSortDirection(direction)) {
        return NextResponse.json({ error: 'Invalid recipe sort direction' }, { status: 400 })
      }
      writes.push(updateRecipeSortPreference(user.id, body.recipe_sort_preference, direction))
    }

    if (hasTypeFilter) {
      if (!isRecipeTypeFilter(body.recipe_type_filter)) {
        return NextResponse.json({ error: 'Invalid recipe type filter' }, { status: 400 })
      }
      writes.push(updateRecipeTypeFilter(user.id, body.recipe_type_filter))
    }
    await Promise.all(writes)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update profile preferences error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update preferences' }, { status: 500 })
  }
}
