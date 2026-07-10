import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile, buildPrefLines } from '@/lib/db/profile'
import { normalizeSkillProfile } from '@/lib/skills'
import { anthropic, HAIKU, extractJsonObject } from '@/lib/anthropic'
import { SkillProfile } from '@/types/database'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Target number of cooked days per week from the onboarding cook_frequency. */
function targetDays(cookFrequency: string | null | undefined): number {
  switch (cookFrequency) {
    case '0-2': return 2
    case '6+': return 7
    case '3-5': return 5
    default: return 5
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { week_start } = await request.json()
    if (!week_start) return NextResponse.json({ error: 'week_start required' }, { status: 400 })

    const [recipesResult, cookingLogResult, profile] = await Promise.all([
      supabase
        .from('recipes')
        .select('id, name, cuisine, difficulty, cook_time_minutes, tags, cooked_count, last_cooked_at')
        .eq('user_id', user.id),
      supabase
        .from('cooking_log')
        .select('recipe_id, cooked_at')
        .eq('user_id', user.id)
        .order('cooked_at', { ascending: false })
        .limit(200),
      getProfile(),
    ])

    const recipes = recipesResult.data || []
    if (recipes.length === 0) {
      return NextResponse.json({ error: 'Add some recipes first' }, { status: 400 })
    }
    const validRecipeIds = new Set(recipes.map(r => r.id))

    // Existing plan → which days are already taken (never touched by auto-fill)
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, weekly_plan_slots(day_of_week, recipe_id)')
      .eq('user_id', user.id)
      .eq('week_start', week_start)
      .maybeSingle()

    const existingSlots = ((plan as { weekly_plan_slots?: { day_of_week: number; recipe_id: string }[] } | null)?.weekly_plan_slots) || []
    const filledDays = new Set(existingSlots.map(s => s.day_of_week))
    const alreadyPlannedRecipeIds = new Set(existingSlots.map(s => s.recipe_id))
    const emptyDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !filledDays.has(d))

    if (emptyDays.length === 0) {
      return NextResponse.json({ slots: [] })
    }

    const skill = normalizeSkillProfile(profile?.skill_profile as SkillProfile | null, profile?.skill_level)
    const target = targetDays(profile?.cook_frequency)
    const daysToFill = Math.min(emptyDays.length, Math.max(0, target - filledDays.size))

    if (daysToFill === 0) {
      return NextResponse.json({ slots: [] })
    }

    // Recipe catalogue for the prompt
    const recipeLines = recipes.map(r => {
      const parts = [
        `id=${r.id}`,
        r.name,
        `cuisine=${r.cuisine || 'various'}`,
        `difficulty=${r.difficulty ?? '?'}`,
        `cook=${r.cook_time_minutes ?? '?'}min`,
        `cooked=${r.cooked_count}x`,
      ]
      if (r.tags?.length) parts.push(`tags=${r.tags.join('/')}`)
      return `- ${parts.join(', ')}`
    }).join('\n')

    // Cooking history summary
    const log = cookingLogResult.data || []
    const recentlyCooked = new Set(
      log.filter(l => (Date.now() - new Date(l.cooked_at).getTime()) / 86_400_000 <= 7).map(l => l.recipe_id)
    )

    const prefLines = buildPrefLines(profile)
    const prefSection = prefLines.length ? `\n\nUser preferences:\n${prefLines.join('\n')}` : ''
    const skillSection = `\nDifficulty ceiling: ${skill.difficulty_ceiling} (never suggest a recipe harder than this).`

    const existingSection = existingSlots.length
      ? `\n\nAlready planned (do NOT change these days, do NOT reuse these recipe ids): ${existingSlots.map(s => `${DAY_LABELS[s.day_of_week]}=${s.recipe_id}`).join(', ')}`
      : ''
    const recentSection = recentlyCooked.size
      ? `\n\nCooked in the last 7 days (avoid): ${[...recentlyCooked].join(', ')}`
      : ''

    const emptyWeekday = emptyDays.filter(d => d <= 3).map(d => DAY_LABELS[d])
    const emptyWeekend = emptyDays.filter(d => d >= 4).map(d => DAY_LABELS[d])

    const prompt = `You are a meal-planning assistant. Fill a weekly dinner plan using ONLY the recipes in the user's library below.

Recipe library (use the exact id):
${recipeLines}
${prefSection}${skillSection}${existingSection}${recentSection}

Empty weekday slots (prefer quick & easy, difficulty ≤ 2, cook time ≤ 30 min): ${emptyWeekday.join(', ') || 'none'}
Empty weekend slots (may be longer / more involved): ${emptyWeekend.join(', ') || 'none'}

Rules:
1. Assign exactly ${daysToFill} of the empty slots (no more, no fewer). Leave the rest blank.
2. Only use recipe ids from the library above.
3. Never repeat a recipe within the week.
4. No cuisine may appear more than twice across the whole week.
5. Respect diet & allergies strictly — never assign a conflicting recipe.
6. Weekdays: bias toward quick, easy, already-cooked recipes. Weekends: harder/longer is fine.
7. Favour recipes with cooked > 0, but you may include one never-cooked recipe if it fits the user's skill and taste.
8. Avoid recipes flagged as cooked in the last 7 days.

Day-of-week numbering: Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6.
Return ONLY valid JSON (no markdown): {"slots":[{"day_of_week":0,"recipe_id":"..."}]}`

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const parsed = extractJsonObject(content.text) as { slots?: { day_of_week: number; recipe_id: string }[] }
    const proposed = Array.isArray(parsed.slots) ? parsed.slots : []

    // Validate: empty day, valid recipe, no dupes, respect target count
    const usedDays = new Set<number>()
    const usedRecipes = new Set<string>(alreadyPlannedRecipeIds)
    const toInsert: { day_of_week: number; recipe_id: string }[] = []
    for (const s of proposed) {
      if (toInsert.length >= daysToFill) break
      const day = Number(s.day_of_week)
      if (!emptyDays.includes(day) || usedDays.has(day)) continue
      if (!validRecipeIds.has(s.recipe_id) || usedRecipes.has(s.recipe_id)) continue
      usedDays.add(day)
      usedRecipes.add(s.recipe_id)
      toInsert.push({ day_of_week: day, recipe_id: s.recipe_id })
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ slots: [] })
    }

    // Ensure a plan row exists
    let planId = (plan as { id?: string } | null)?.id
    if (!planId) {
      const { data: newPlan, error } = await supabase
        .from('weekly_plans')
        .insert({ user_id: user.id, week_start })
        .select('id')
        .single()
      if (error) throw error
      planId = (newPlan as { id: string }).id
    }

    const { data: inserted, error: insertError } = await supabase
      .from('weekly_plan_slots')
      .insert(toInsert.map(s => ({
        plan_id: planId,
        recipe_id: s.recipe_id,
        day_of_week: s.day_of_week,
        meal_type: 'dinner',
      })))
      .select('*, recipe:recipes(*)')
    if (insertError) throw insertError

    return NextResponse.json({ slots: inserted })
  } catch (error) {
    console.error('Auto-fill error:', error)
    return NextResponse.json({ error: 'Failed to auto-fill' }, { status: 500 })
  }
}
