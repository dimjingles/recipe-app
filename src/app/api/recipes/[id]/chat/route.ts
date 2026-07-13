import { NextRequest, NextResponse } from 'next/server'
import { anthropic, SONNET } from '@/lib/anthropic'
import { createClient, getUser } from '@/lib/supabase/server'
import { getRecipe } from '@/lib/db/recipes'
import { getProfile, updateSkillProfile } from '@/lib/db/profile'
import { findReadyTechnique, isRecipeTechnique, normalizeSkillProfile } from '@/lib/skills'
import { buildChefStyleDirectives, chefPreferencesFromProfile } from '@/lib/cook/chef-preferences'
import type { Technique } from '@/types/database'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser()
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
  const catalogueItems = (catalogue || []) as Technique[]
  const recipeSpecificCatalogue = catalogueItems.filter(isRecipeTechnique)
  const recipeTechniques = recipeSpecificCatalogue.filter(t => recipeTechniqueKeys.includes(t.key))
  const stretchTechnique = findReadyTechnique(recipeTechniques, skillProfile)
    || findReadyTechnique(recipeSpecificCatalogue, skillProfile)

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

  // Prefer structured steps (same numbered format the UI shows) over raw text.
  const instructionBlock = (() => {
    const structured = (recipe as { instruction_steps?: { n: number; text: string }[] | null }).instruction_steps
    if (structured && structured.length > 0) {
      return structured.map(s => `${s.n}. ${s.text}`).join('\n')
    }
    return recipe.instructions || 'No instructions listed'
  })()

  const system = [
    `You are Chef AI, a warm and patient cooking coach inside the PrepTable app.`,
    ``,
    `You are helping the user cook: ${recipe.name}.`,
    ``,
    `RECIPE DETAILS:`,
    `Servings: ${recipe.servings || 'unknown'}`,
    `Cook time: ${recipe.cook_time_minutes || 'unknown'} minutes`,
    `Difficulty: ${recipe.difficulty || 'unknown'}`,
    ``,
    `INGREDIENTS:`,
    ingredients || 'No ingredients listed',
    ``,
    `INSTRUCTIONS (these are the numbered steps shown in the app — always use these step numbers):`,
    instructionBlock,
    ``,
    `RECIPE TECHNIQUES:`,
    techniqueContext,
    ``,
    `USER SKILL STATE:`,
    `Mastered: ${skillProfile.techniques_mastered.join(', ') || 'none'}`,
    `Seen: ${skillProfile.techniques_seen.join(', ') || 'none'}`,
    stretchContext,
    ``,
    `COACHING RULES:`,
    `- Treat the INSTRUCTIONS block as the source of truth. Do not invent a different cooking sequence.`,
    `- When the user asks for a welcome or overview, give a warm 2-3 sentence intro to the dish (what you're making and the general vibe) WITHOUT listing any steps, and end by asking if they are ready to begin.`,
    `- When the user asks you to present a specific numbered step, narrate exactly that step now in a warm, spoken style (2-4 short sentences). Do not preview, summarise, or jump to later steps.`,
    `- Keep every reply short enough to comfortably read aloud.`,
    `- Present one step at a time. After presenting a step, wait for the user to say they are ready before giving the next step.`,
    `- Always refer to steps by the same number shown in the app (Step 1, Step 2, etc.).`,
    `- If the user asks a question, answer using the specific ingredients and quantities from this recipe, then offer to continue.`,
    `- When a step contains cooking jargon or a technique (e.g. "fold", "deglaze", "temper"), briefly explain what it means in one plain sentence before describing what to do.`,
    `- When a step has a vague sensory completion cue (e.g. "until golden brown", "until fragrant", "until fork-tender"), translate it into a concrete, observable description — what does it look like, smell like, feel like — plus a rough time range if you can.`,
    `- When asked about a specific step, explain: (1) what to do, (2) why it matters, (3) what success looks/smells/sounds like, and (4) the most common mistake to avoid. Use the exact ingredients and quantities from this recipe.`,
    `- If the stretch technique applies to the current step, explain why it matters in one short sentence.`,
    `- Be warm, encouraging, and concise. Never dump all steps at once.`,
    `- If the user says done, next, ok, ready, or similar, advance to the next step.`,
    `- If the user asks what to cook next or what to learn next, give a concise recommendation grounded in this recipe and suggest one technique to practise.`,
    `- When all steps are complete, congratulate the user.`,
    ``,
    ...buildChefStyleDirectives(chefPreferencesFromProfile(profile)),
  ].join('\n')

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
