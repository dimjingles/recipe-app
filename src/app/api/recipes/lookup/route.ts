import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, OPUS, SONNET_5, LONG_CALL } from '@/lib/anthropic'
import { getUser } from '@/lib/supabase/server'
import { fetchFirstImageAsBase64, type FetchedImage } from '@/lib/images/fetch-base64'

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
    calories: { type: 'integer' },
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
    'calories',
    'description',
    'instructions',
    'difficulty',
  ],
  additionalProperties: false,
} as const

// Same schema, with a forced grounding field in front. Structured outputs generate
// keys in schema order, so making `photo_observations` the first required property
// means the model has to commit to what it actually sees before it writes a single
// ingredient — the recipe is then written against its own reading of the photo
// rather than against the dish name. We never persist the field; producing it is
// the whole point.
const PHOTO_RECIPE_SCHEMA = {
  ...RECIPE_SCHEMA,
  properties: {
    photo_observations: {
      type: 'string',
      description:
        'What you can actually see in this photo: the specific ingredients, their cut and size, the sauce or coating, garnishes, doneness, and plating. Describe the dish in front of you, not the dish you expect. Everything below must match this.',
    },
    ...RECIPE_SCHEMA.properties,
  },
  required: ['photo_observations', ...RECIPE_SCHEMA.required],
} as const

function buildPrompt(name: string, hasImage: boolean): string {
  const opening = hasImage
    ? `You are a culinary expert. The attached photo shows the dish the user wants to cook. They call it "${name}".

Write the recipe for the version in this photo, not a generic version of "${name}". Look closely and work from what is actually there: the visible ingredients, how each component is cut and sized, the sauce or coating, the garnishes and finishing touches, what the browning and texture say about the cooking method, and how much is on the plate. Your ingredient list and your steps must produce what is shown. Where the photo genuinely doesn't settle something, fall back to the most common home-cook version of "${name}".`
    : `You are a culinary expert. Return the most common home-cook version of "${name}".`

  return `${opening}

Use realistic quantities for a home meal. Write clear, actionable step-by-step instructions as a single string, numbering each step (1., 2., etc.) and being specific about temperatures, timings, and techniques.

Estimate calories PER SERVING — a whole number derived from the ingredients and quantities you listed, divided by the number of servings you specified.

Difficulty rating, based on the complexity of the instructions you write:
- 1 = Easy — simple techniques, few steps, beginner-friendly
- 2 = Medium — requires some skill, multiple components, moderate timing
- 3 = Hard — advanced techniques, precise timing, complex preparations`
}

// Ask the model for a recipe, optionally letting it "see" the photo the user
// picked (inlined as base64) so the recipe is written to match that specific
// version — the ingredients and steps reflect what's actually in the image.
function generateRecipe(name: string, image?: FetchedImage) {
  const prompt = buildPrompt(name, !!image)
  const content = image
    ? [
        {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
        },
        { type: 'text' as const, text: prompt },
      ]
    : prompt
  return anthropic.messages.create({
    // Opus only earns its price reading a dish off a photo; a name-only recipe is
    // plain recipe writing, which Sonnet 5 handles at well under half the cost.
    model: image ? OPUS : SONNET_5,
    // Opus 5 / Sonnet 5 think by default, and thinking shares this budget with the response —
    // 4096 (fine on Haiku) can truncate a long recipe mid-instructions. `low` effort
    // suits a scoped extraction task like this and keeps latency down; the user is
    // staring at a full-screen spinner until we return.
    max_tokens: 8192,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: image ? PHOTO_RECIPE_SCHEMA : RECIPE_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  }, LONG_CALL)
}

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, imageUrl, thumbnailUrl } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
    }

    // Download the picked photo ourselves and inline it — Anthropic often can't
    // fetch the raw hotlink. Try the full image first, then the (reliably
    // hostable) search thumbnail. A null result means we generate name-only.
    const image =
      imageUrl || thumbnailUrl
        ? await fetchFirstImageAsBase64(imageUrl, thumbnailUrl)
        : null

    // Whether the model actually got to see the photo. The download can fail for
    // reasons the user can't predict (hotlink 403, timeout, oversized file), and
    // the caller needs to know — otherwise we hand back a generic recipe under a
    // photo the user picked and imply the two match.
    let photoUsed = !!image

    let message
    try {
      message = await generateRecipe(name, image ?? undefined)
    } catch (err) {
      // The image is already downloaded and validated, so this is unlikely — but
      // if the model still rejects it (e.g. odd dimensions), don't fail the whole
      // request: retry name-only so the user still gets a recipe. Only a 400 means
      // "bad image"; rate limits and timeouts would just fail again (and the SDK
      // has already retried those).
      if (image && err instanceof Anthropic.BadRequestError) {
        message = await generateRecipe(name)
        photoUsed = false
      } else {
        throw err
      }
    }

    // A safety-classifier refusal comes back as a normal 200 with no content
    // blocks, so check it before indexing into `content`.
    const content = message.content[0]
    if (message.stop_reason === 'refusal' || !content) {
      return NextResponse.json(
        { error: 'Could not generate a recipe for that dish. Try a different name.' },
        { status: 502 },
      )
    }
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    // With structured outputs the text is guaranteed to be schema-valid JSON.
    const recipeData = JSON.parse(content.text)
    return NextResponse.json({ ...recipeData, photo_used: photoUsed })
  } catch (error: any) {
    console.error('Recipe lookup error:', error)
    const msg = error?.status
      ? `AI error ${error.status}: ${error.message}`
      : (error?.message || 'Failed to lookup recipe')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
