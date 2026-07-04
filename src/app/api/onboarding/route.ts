import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeOnboarding } from '@/lib/db/profile'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    await completeOnboarding({
      household_size:    body.household_size    ?? null,
      cook_frequency:    body.cook_frequency    ?? null,
      referral_source:   body.referral_source   ?? null,
      primary_goal:      body.primary_goal      ?? null,
      diet:              body.diet              ?? null,
      allergies:         Array.isArray(body.allergies)         ? body.allergies         : [],
      favorite_cuisines: Array.isArray(body.favorite_cuisines) ? body.favorite_cuisines : [],
      skill_level:       body.skill_level       ?? null,
      meal_reminders:    body.meal_reminders    ?? false,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Onboarding submit error:', error)
    return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 })
  }
}
