import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { anthropic, HAIKU } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [recipesResult, profile] = await Promise.all([
      supabase
        .from('recipes')
        .select('name, cuisine, tags, cooked_count')
        .eq('user_id', user.id)
        .order('cooked_count', { ascending: false }),
      getProfile(),
    ])

    const recipeList = recipesResult.data?.map(r =>
      `${r.name} (${r.cuisine || 'various'}, cooked ${r.cooked_count}x${r.tags?.length ? ', tags: ' + r.tags.join(', ') : ''})`
    ).join('\n') || 'No recipes yet'

    // Build personalization context from onboarding answers
    const prefLines: string[] = []
    if (profile?.diet && profile.diet !== 'balanced') {
      prefLines.push(`Diet: ${profile.diet.replace('_', '-')}`)
    }
    if (profile?.favorite_cuisines?.length) {
      prefLines.push(`Favourite cuisines: ${profile.favorite_cuisines.join(', ')}`)
    }
    if (profile?.allergies?.length && !profile.allergies.includes('none')) {
      prefLines.push(`Allergies / avoid: ${profile.allergies.join(', ')}`)
    }
    const goals = profile?.primary_goals?.length
      ? profile.primary_goals
      : profile?.primary_goal
        ? [profile.primary_goal]
        : []
    if (goals.length) {
      prefLines.push(`Cooking goals: ${goals.map(goal => goal.replace('_', ' ')).join(', ')}`)
    }
    if (profile?.skill_level) {
      prefLines.push(`Skill level: ${profile.skill_level.replace('_', ' ')}`)
    }
    if (profile?.household_size) {
      prefLines.push(`Cooking for: ${profile.household_size.replace('_', ' ')}`)
    }
    const prefSection = prefLines.length
      ? `\n\nUser preferences from onboarding:\n${prefLines.join('\n')}`
      : ''

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert helping someone discover new recipes they'd enjoy at home.

Based on these recipes they already cook:
${recipeList}${prefSection}

Suggest 5 new recipes they would likely enjoy. Respect dietary restrictions and allergies strictly — never suggest something they avoid. Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "Recipe Name",
    "cuisine": "cuisine type",
    "description": "2-3 sentence description",
    "why": "one sentence explaining why they'd enjoy this based on their existing recipes and preferences",
    "cook_time_minutes": 30
  }
]

Vary cuisines and cooking styles. Prefer recipes that share some ingredients with their existing ones for convenience.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse recommendations' }, { status: 500 })
    }

    const recommendations = JSON.parse(jsonMatch[0])
    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Recommend error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}
