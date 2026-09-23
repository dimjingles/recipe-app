import { NextRequest, NextResponse, after } from 'next/server'
import { anthropic, extractJsonObject, HAIKU, LONG_CALL } from '@/lib/anthropic'
import { enrichRecipe } from '@/lib/ai/enrich-recipe'
import { structureInstructions } from '@/lib/ai/structure-instructions'
import { getRecipeForAI } from '@/lib/db/recipes'
import { createClient, getUser } from '@/lib/supabase/server'

function formatInstructionSource(recipe: Awaited<ReturnType<typeof getRecipeForAI>>): string {
  if (!recipe) return ''
  const structured = (recipe as { instruction_steps?: { n: number; text: string }[] | null }).instruction_steps
  if (structured && structured.length > 0) {
    return structured.map(step => `${step.n}. ${step.text}`).join('\n')
  }
  return recipe.instructions || ''
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const stepNumber = Number(body.stepNumber)
    const stepText = typeof body.stepText === 'string' ? body.stepText.trim() : ''
    const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : ''

    if (!Number.isInteger(stepNumber) || stepNumber < 1 || !userMessage) {
      return NextResponse.json({ error: 'Missing instruction update details' }, { status: 400 })
    }

    const recipe = await getRecipeForAI(id)
    if (!recipe || recipe.user_id !== user.id) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    const currentInstructions = formatInstructionSource(recipe)
    if (!currentInstructions.trim()) {
      return NextResponse.json({ error: 'Recipe has no instructions to update' }, { status: 400 })
    }

    const result = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1600,
      messages: [
        {
          role: 'user',
          content: `Revise this recipe's existing instructions to include a user-approved cooking update for future reference.

Rules:
- Preserve the same overall recipe and step order.
- Apply the change to the relevant step only unless it clearly affects another step.
- Keep instructions concise, numbered, and actionable.
- Do not mention the chat, the user, or that this was an update.
- Return ONLY valid JSON with this shape: { "instructions": "1. ..." }

Recipe: ${recipe.name}
Target step: ${stepNumber}. ${stepText || '(step text not supplied)'}
Approved update to incorporate: ${userMessage}

Current instructions:
${currentInstructions}`,
        },
      ],
    }, LONG_CALL)

    const text = result.content.find(part => part.type === 'text')?.text || ''
    const parsed = extractJsonObject(text) as { instructions?: unknown }
    const instructions = typeof parsed.instructions === 'string' ? parsed.instructions.trim() : ''

    if (!instructions) {
      return NextResponse.json({ error: 'Could not revise instructions' }, { status: 502 })
    }

    // The revision comes back numbered, so structuring is deterministic and
    // instant; re-classifying techniques is an AI call, so it runs after the
    // response.
    const instruction_steps = await structureInstructions(recipe.name, instructions)

    const { data: updatedRecipe, error } = await supabase
      .from('recipes')
      .update({
        instructions,
        instruction_steps: instruction_steps.length ? instruction_steps : null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    after(() => enrichRecipe(id, user.id, recipe.name, instructions))

    return NextResponse.json({ recipe: updatedRecipe, instructions })
  } catch (error: any) {
    console.error('Instruction update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update instructions' }, { status: 500 })
  }
}
