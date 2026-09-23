import Anthropic from '@anthropic-ai/sdk'

/** Shared Anthropic client — reads ANTHROPIC_API_KEY from the environment. */
export const anthropic = new Anthropic()

export const HAIKU = 'claude-haiku-4-5-20251001'
export const SONNET = 'claude-sonnet-4-6'
// High-resolution vision (2576px long edge, vs 1568px on Haiku) — worth the cost
// where the model has to read a dish off a plate. Note thinking is on by default
// on Opus 5 and shares the `max_tokens` budget with the response.
export const OPUS = 'claude-opus-5'
// Text-only recipe writing: strong enough for a home-cook recipe at a fraction of
// Opus's price. Thinks adaptively by default (shares `max_tokens`), like Opus 5.
export const SONNET_5 = 'claude-sonnet-5'

// Per-request options. The SDK default is a 10-minute timeout with 2 retries,
// so one hung call could stall a request for half an hour.
/** Small classification / enrichment calls — best-effort, fail fast. */
export const QUICK_CALL = { timeout: 20_000, maxRetries: 1 }
/** Recipe generation / extraction / adaptation — the user is waiting on these. */
export const LONG_CALL = { timeout: 90_000, maxRetries: 1 }

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
