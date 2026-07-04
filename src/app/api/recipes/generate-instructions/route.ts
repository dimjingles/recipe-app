import { NextRequest, NextResponse } from 'next/server'
import { anthropic, HAIKU } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const { name, ingredients } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
    }

    const ingredientList = Array.isArray(ingredients) && ingredients.length > 0
      ? ingredients.map((i: any) => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim()).join('\n')
      : 'See typical ingredients for this dish'

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert. Generate step-by-step cooking instructions for "${name}".

Ingredients:
${ingredientList}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "instructions": "Step-by-step instructions as a single string. Number each step (1., 2., etc.). Be specific about temperatures, timings, and techniques. Keep steps clear and actionable.",
  "difficulty": 1
}

Difficulty rating:
- 1 = Easy (🔪) — simple techniques, few steps, beginner-friendly
- 2 = Medium (🔪🔪) — requires some skill, multiple components, moderate timing
- 3 = Hard (🔪🔪🔪) — advanced techniques, precise timing, complex preparations

Base the difficulty on the complexity of the instructions you just wrote.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      instructions: data.instructions || '',
      difficulty: typeof data.difficulty === 'number' && data.difficulty >= 1 && data.difficulty <= 3
        ? data.difficulty
        : null,
    })
  } catch (error) {
    console.error('Generate instructions error:', error)
    return NextResponse.json({ error: 'Failed to generate instructions' }, { status: 500 })
  }
}
