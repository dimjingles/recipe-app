import { NextRequest, NextResponse } from 'next/server'
import { anthropic, SONNET } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getRecipe } from '@/lib/db/recipes'
import { getProfile, updateSkillProfile } from '@/lib/db/profile'
import { findReadyTechnique, normalizeSkillProfile } from '@/lib/skills'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const recipe = await getRecipe(id)
  if (!recipe || recipe.user_id !== user.id) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

  const ingredients = (recipe.ingredients || [])
    .map(i => `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}${i.category ? ` (${i.category})` : ''}`)
    .join('\n')

  const [profile, { data: catalogue }] = await Promise.all([
    getProfile(),
    supabase.from('techniques').select('*').order('category').order('label'),
  ])
  const skillProfile = normalizeSkillProfile(profile?.skill_profile, profile?.skill_level)
  const recipeTechniqueKeys = recipe.techniques || []
  const recipeTechniques = (catalogue || []).filter(t => recipeTechniqueKeys.includes(t.key))
  const stretchTechnique = findReadyTechnique(recipeTechniques, skillProfile)
    || findReadyTechnique(catalogue || [], skillProfile)

  if (stretchTechnique) {
    await updateSkillProfile(user.id, {
      newSeenKeys: [stretchTechnique.key],
      lastStretchTechnique: stretchTechnique.key,
    })
  }

  const techniqueContext = recipeTechniques.length
    ? recipeTechniques.map(t => `- ${t.label}: ${t.description}`).join('\n')
    : 'No techniques classified yet.'
  const stretchContext = stretchTechnique
    ? `Suggested skill stretch: ${stretchTechnique.label}. Explain this technique briefly when it first appears, then coach the user through it without overloading them.`
    : 'No new skill stretch available. Keep coaching focused on confidence and clarity.'

  const system = `You are Chef AI, a warm and patient cooking coach inside the Mise en Place app.\n\nYou are helping the user cook: ${recipe.name}.\n\nRECIPE DETAILS:\nServings: ${recipe.servings || 'unknown'}\nCook time: ${recipe.cook_time_minutes || 'unknown'} minutes\nDifficulty: ${recipe.difficulty || 'unknown'}\n\nINGREDIENTS:\n${ingredients || 'No ingredients listed'}\n\nINSTRUCTIONS:\n${recipe.instructions || 'No instructions listed'}\n\nRECIPE TECHNIQUES:\n${techniqueContext}\n\nUSER SKILL STATE:\nMastered: ${skillProfile.techniques_mastered.join(', ') || 'none'}\nSeen: ${skillProfile.techniques_seen.join(', ') || 'none'}\n${stretchContext}\n\nCOACHING RULES:\n- Present one step at a time. After presenting a step, wait for the user to say they are ready before giving the next step.\n- If the user asks a question, answer using the specific ingredients and quantities from this recipe, then offer to continue.\n- If the stretch technique applies to the current step, explain why it matters in one short sentence.\n- Be warm, encouraging, and concise. Never dump all steps at once.\n- If the user says done, next, ok, ready, or similar, advance to the next step.\n- If the user asks what to cook next or what to learn next, give a concise recommendation grounded in this recipe and suggest one technique to practise.\n- When all steps are complete, congratulate the user.`

  const messages = Array.isArray(body.messages) && body.messages.length
    ? body.messages
    : [{ role: 'user', content: 'Start cooking this recipe with me. Give me the first step only.' }]

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream({
          model: SONNET,
          max_tokens: 1024,
          system,
          messages,
        })
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('Chef AI stream error:', error)
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Chef AI is unavailable' })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
