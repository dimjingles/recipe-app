import { NextRequest, NextResponse } from 'next/server'
import { anthropic, HAIKU } from '@/lib/anthropic'

// Structured-output schema. Constraining the model to this schema guarantees the
// response is valid, parseable JSON — Haiku occasionally emitted malformed JSON
// (e.g. an unquoted value) when we free-formed it and asked for JSON in the prompt,
// which threw on JSON.parse and 500'd the whole request.
const CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string' },
          unit: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
        },
        required: ['name', 'quantity', 'unit', 'category'],
        additionalProperties: false,
      },
    },
    cuisine: { type: 'string' },
    recipe_type: { type: 'string', enum: ['appetizer', 'main', 'dessert', 'drink'] },
    cook_time_minutes: { type: 'integer' },
    servings: { type: 'integer' },
    description: { type: 'string' },
    instructions: { type: 'string' },
    difficulty: { type: 'integer', enum: [1, 2, 3] },
  },
  required: [
    'ingredients',
    'cuisine',
    'recipe_type',
    'cook_time_minutes',
    'servings',
    'description',
    'instructions',
    'difficulty',
  ],
  additionalProperties: false,
} as const

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `You are a culinary expert. Return the most common home-cook version of "${name}".

Use realistic quantities for a home meal. Write clear, actionable step-by-step instructions as a single string, numbering each step (1., 2., etc.) and being specific about temperatures, timings, and techniques.

Difficulty rating, based on the complexity of the instructions you write:
- 1 = Easy — simple techniques, few steps, beginner-friendly
- 2 = Medium — requires some skill, multiple components, moderate timing
- 3 = Hard — advanced techniques, precise timing, complex preparations`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    // With structured outputs the text is guaranteed to be schema-valid JSON.
    const recipeData = JSON.parse(content.text)
    return NextResponse.json(recipeData)
  } catch (error: any) {
    console.error('Recipe lookup error:', error)
    const msg = error?.status
      ? `AI error ${error.status}: ${error.message}`
      : (error?.message || 'Failed to lookup recipe')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
