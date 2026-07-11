export interface InstructionUpdateCandidateInput {
  stepNumber: number
  stepText: string
  userMessage: string
}

export interface InstructionUpdateCandidate extends InstructionUpdateCandidateInput {
  summary: string
}

const DURABLE_UPDATE_PATTERNS = [
  /\b(instead of|rather than|replace|swap|substitut(?:e|ed|ing)|use .+ instead)\b/i,
  /\b(add(?:ed)?|mix(?:ed)? in|include|omit(?:ted)?|skip(?:ped)?|leave out)\b/i,
  /\b(change(?:d)?|adjust(?:ed)?|reduce(?:d)?|increase(?:d)?|more|less)\b/i,
  /\b(next time|for future|from now on|worked better|turns out|make sure)\b/i,
  /\b(i used|i added|i skipped|i changed|i swapped|i substituted)\b/i,
]

const ONE_OFF_PATTERNS = [
  /^\s*(how|what|when|where|why|can|could|should|do|does|is|are)\b/i,
  /\?\s*$/,
  /\b(help|stuck|confused|explain|repeat|next|done|ready|timer)\b/i,
]

export function shouldOfferInstructionUpdate(message: string): boolean {
  const text = message.trim()
  if (!text) return false

  const hasDurableSignal = DURABLE_UPDATE_PATTERNS.some(pattern => pattern.test(text))
  if (!hasDurableSignal) return false

  const looksOneOff = ONE_OFF_PATTERNS.some(pattern => pattern.test(text))
  return !looksOneOff || /\b(instead of|replace|swap|substitut(?:e|ed|ing)|i used|i added|i skipped|i changed|i swapped)\b/i.test(text)
}

export function buildInstructionUpdateCandidate(input: InstructionUpdateCandidateInput): InstructionUpdateCandidate {
  const userMessage = input.userMessage.trim()
  return {
    stepNumber: input.stepNumber,
    stepText: input.stepText.trim(),
    userMessage,
    summary: `Step ${input.stepNumber} update: ${userMessage}`,
  }
}
