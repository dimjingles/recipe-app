import { NextRequest, NextResponse } from 'next/server'
import { anthropic, extractJsonObject, HAIKU } from '@/lib/anthropic'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'
import { structureInstructions } from '@/lib/ai/structure-instructions'
import { getRecipe } from '@/lib/db/recipes'
import { createClient, getUser } from '@/lib/supabase/server'

function formatInstructionSource(recipe: Awaited<ReturnType<typeof getRecipe>>): string {
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

    const recipe = await getRecipe(id)
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
    })

    const text = result.content.find(part => part.type === 'text')?.text || ''
    const parsed = extractJsonObject(text) as { instructions?: unknown }
    const instructions = typeof parsed.instructions === 'string' ? parsed.instructions.trim() : ''

    if (!instructions) {
      return NextResponse.json({ error: 'Could not revise instructions' }, { status: 502 })
    }

    const [techniques, instruction_steps] = await Promise.all([
      getTechniqueKeys(supabase).then(keys => classifyTechniques(recipe.name, instructions, keys)),
      structureInstructions(recipe.name, instructions),
    ])

    const { data: updatedRecipe, error } = await supabase
      .from('recipes')
      .update({
        instructions,
        techniques,
        instruction_steps: instruction_steps.length ? instruction_steps : null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ recipe: updatedRecipe, instructions })
  } catch (error: any) {
    console.error('Instruction update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update instructions' }, { status: 500 })
  }
}
