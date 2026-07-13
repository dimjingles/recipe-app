import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { updateRecipeSortPreference } from '@/lib/db/profile'
import type { RecipeSortPreference, RecipeSortDirection } from '@/types/database'

const RECIPE_SORT_PREFERENCES: RecipeSortPreference[] = ['ranking', 'recently_cooked', 'most_cooked', 'cook_time']
const RECIPE_SORT_DIRECTIONS: RecipeSortDirection[] = ['default', 'reversed']

function isRecipeSortPreference(value: unknown): value is RecipeSortPreference {
  return typeof value === 'string' && RECIPE_SORT_PREFERENCES.includes(value as RecipeSortPreference)
}

function isRecipeSortDirection(value: unknown): value is RecipeSortDirection {
  return typeof value === 'string' && RECIPE_SORT_DIRECTIONS.includes(value as RecipeSortDirection)
}

export async function PATCH(request: NextRequest) {
  try {
  const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!isRecipeSortPreference(body.recipe_sort_preference)) {
      return NextResponse.json({ error: 'Invalid recipe sort preference' }, { status: 400 })
    }

    // Direction is optional for backwards compatibility; default to top-to-bottom.
    const direction = body.recipe_sort_direction ?? 'default'
    if (!isRecipeSortDirection(direction)) {
      return NextResponse.json({ error: 'Invalid recipe sort direction' }, { status: 400 })
    }

    await updateRecipeSortPreference(user.id, body.recipe_sort_preference, direction)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update profile preferences error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update preferences' }, { status: 500 })
  }
}
