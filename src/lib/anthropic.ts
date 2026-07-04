import Anthropic from '@anthropic-ai/sdk'

/** Shared Anthropic client — reads ANTHROPIC_API_KEY from the environment. */
export const anthropic = new Anthropic()

/** Extract the first JSON object `{…}` from an LLM text response. */
export function extractJsonObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in response')
  return JSON.parse(match[0])
}

/** Extract the first JSON array `[…]` from an LLM text response. */
export function extractJsonArray(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array found in response')
  return JSON.parse(match[0])
}
