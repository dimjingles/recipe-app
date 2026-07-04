import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: recipes } = await supabase
      .from('recipes')
      .select('name, cuisine, tags, cooked_count')
      .eq('user_id', user.id)
      .order('cooked_count', { ascending: false })

    const recipeList = recipes?.map(r =>
      `${r.name} (${r.cuisine || 'various'}, cooked ${r.cooked_count}x${r.tags?.length ? ', tags: ' + r.tags.join(', ') : ''})`
    ).join('\n') || 'No recipes yet'

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert helping someone discover new recipes they'd enjoy at home.

Based on these recipes they already cook:
${recipeList}

Suggest 5 new recipes they would likely enjoy. Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "Recipe Name",
    "cuisine": "cuisine type",
    "description": "2-3 sentence description",
    "why": "one sentence explaining why they'd enjoy this based on their existing recipes",
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
