import { anthropic, HAIKU, extractJsonArray } from '@/lib/anthropic'

let cachedKeys: string[] | null = null

export async function getTechniqueKeys(supabase: any): Promise<string[]> {
  if (cachedKeys) return cachedKeys
  const { data, error } = await supabase.from('techniques').select('key').order('key')
  if (error) {
    console.error('getTechniqueKeys error:', error)
    return []
  }
  const keys = (data || []).map((t: { key: string }) => t.key)
  cachedKeys = keys
  return keys
}

export async function classifyTechniques(
  recipeName: string,
  instructions: string | null | undefined,
  allKeys: string[]
): Promise<string[]> {
  if (!instructions?.trim() || allKeys.length === 0) return []
  const message = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are a culinary expert. Given the cooking instructions for "${recipeName}", identify which cooking techniques are used.\n\nTechniques catalogue. Use ONLY keys from this list:\n${allKeys.join(', ')}\n\nInstructions:\n${instructions.slice(0, 3000)}\n\nReturn ONLY a valid JSON array of matching technique keys. If none match, return [].`,
    }],
  })
  const content = message.content[0]
  if (content.type !== 'text') return []
  try {
    const parsed = extractJsonArray(content.text)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k): k is string => typeof k === 'string' && allKeys.includes(k))
  } catch {
    return []
  }
}
