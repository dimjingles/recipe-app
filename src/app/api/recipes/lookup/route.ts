import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert. Return the most common home-cook version of "${name}" as JSON.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit of measure", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
  ],
  "cuisine": "cuisine type",
  "cook_time_minutes": 30,
  "servings": 4,
  "description": "1-2 sentence description of the dish"
}

Use realistic quantities for a home meal. Category must be one of: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, other.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse recipe data' }, { status: 500 })
    }

    const recipeData = JSON.parse(jsonMatch[0])
    return NextResponse.json(recipeData)
  } catch (error) {
    console.error('Recipe lookup error:', error)
    return NextResponse.json({ error: 'Failed to lookup recipe' }, { status: 500 })
  }
}
