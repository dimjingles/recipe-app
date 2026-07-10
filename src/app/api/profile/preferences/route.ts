import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateRecipeSortPreference } from '@/lib/db/profile'
import type { RecipeSortPreference } from '@/types/database'

const RECIPE_SORT_PREFERENCES: RecipeSortPreference[] = ['ranking', 'recently_cooked', 'most_cooked', 'cook_time']

function isRecipeSortPreference(value: unknown): value is RecipeSortPreference {
  return typeof value === 'string' && RECIPE_SORT_PREFERENCES.includes(value as RecipeSortPreference)
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!isRecipeSortPreference(body.recipe_sort_preference)) {
      return NextResponse.json({ error: 'Invalid recipe sort preference' }, { status: 400 })
    }

    await updateRecipeSortPreference(user.id, body.recipe_sort_preference)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update profile preferences error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update preferences' }, { status: 500 })
  }
}
