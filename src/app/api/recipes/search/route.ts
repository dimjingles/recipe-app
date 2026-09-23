import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { anthropic, HAIKU, QUICK_CALL } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()
    if (!query?.trim()) {
      return NextResponse.json({ results: [] })
    }

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert. Find 5 well-known recipes that match the search query: "${query}"

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "results": [
    {
      "name": "exact recipe name",
      "cuisine": "cuisine type",
      "cook_time_minutes": 30,
      "description": "one sentence description"
    }
  ]
}

Rules:
- Return real, cookable recipes that home cooks would make
- If the query is a specific recipe name, include that recipe first then variations
- If the query is a cuisine or ingredient, return diverse recipes featuring it
- Keep descriptions to one sentence`,
        },
      ],
    }, QUICK_CALL)

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ results: [] })
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ results: [] })
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch (error) {
    console.error('Recipe search error:', error)
    return NextResponse.json({ error: 'Failed to search recipes' }, { status: 500 })
  }
}
