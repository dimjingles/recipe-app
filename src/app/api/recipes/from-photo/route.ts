import { NextRequest, NextResponse } from 'next/server'
import { anthropic, HAIKU } from '@/lib/anthropic'
import type { AnthropicImageMediaType } from '@/lib/images/fetch-base64'

// Anthropic rejects base64 images larger than ~5MB. The client downscales
// before sending, but guard here too so a stray large upload fails cleanly
// (413) instead of bubbling up as an opaque AI error.
const MAX_BASE64_BYTES = 4.5 * 1024 * 1024

const ANTHROPIC_IMAGE_TYPES = new Set<AnthropicImageMediaType>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

// Structured-output schema — the model must both identify the dish (`name`) and
// write the full recipe from what it sees in the photo. Constraining to a schema
// guarantees valid, parseable JSON (see lookup/route.ts for the same rationale).
const CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
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
    'name',
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

const PROMPT = `You are a culinary expert. Look closely at this photo of a finished dish.

First, identify what the dish is and give it a clear, specific name (e.g. "Spaghetti Carbonara", not "Pasta"). Then return the most common home-cook version of that dish, letting the photo guide the specifics — the style, the ingredients you can see, the plating, and the likely preparation.

Use realistic quantities for a home meal. Write clear, actionable step-by-step instructions as a single string, numbering each step (1., 2., etc.) and being specific about temperatures, timings, and techniques.

Difficulty rating, based on the complexity of the instructions you write:
- 1 = Easy — simple techniques, few steps, beginner-friendly
- 2 = Medium — requires some skill, multiple components, moderate timing
- 3 = Hard — advanced techniques, precise timing, complex preparations`

// Parse a `data:<mediaType>;base64,<data>` URL into the pieces Anthropic's
// vision API needs. Returns null for anything that isn't a supported image.
function parseDataUrl(
  dataUrl: unknown,
): { mediaType: AnthropicImageMediaType; base64: string } | null {
  if (typeof dataUrl !== 'string') return null
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!match) return null
  let mediaType = match[1].trim().toLowerCase()
  if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
  if (!ANTHROPIC_IMAGE_TYPES.has(mediaType as AnthropicImageMediaType)) return null
  return { mediaType: mediaType as AnthropicImageMediaType, base64: match[2] }
}

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()
    const parsed = parseDataUrl(image)
    if (!parsed) {
      return NextResponse.json(
        { error: 'A JPEG, PNG, GIF, or WebP photo is required' },
        { status: 400 },
      )
    }
    if (parsed.base64.length > MAX_BASE64_BYTES) {
      return NextResponse.json({ error: 'Photo is too large' }, { status: 413 })
    }

    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 },
            },
            { type: 'text', text: PROMPT },
          ],
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
    console.error('Recipe from-photo error:', error)
    const msg = error?.status
      ? `AI error ${error.status}: ${error.message}`
      : error?.message || 'Failed to generate recipe from photo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
