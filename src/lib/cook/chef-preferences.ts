import type {
  ChefPersona,
  ChefSkillPref,
  ChefPacing,
  Profile,
} from '@/types/database'

// Single source of truth for the "Cook with AI" personalisation options.
// Consumed by the settings UI (labels/descriptions) and the chat route
// (prompt fragments), so the two never drift.

export interface ChefOption<K extends string> {
  key: K
  /** Short label shown in settings. */
  label: string
  /** One-line explanation shown under the label. */
  description: string
  /** Directive injected into the Chef AI system prompt. */
  prompt: string
}

export const CHEF_PERSONAS: ChefOption<ChefPersona>[] = [
  {
    key: 'warm',
    label: 'Warm & patient',
    description: 'Encouraging and gentle — the classic coach.',
    prompt:
      'Persona: warm and patient coach. Be gentle, reassuring, and encouraging throughout.',
  },
  {
    key: 'pro',
    label: 'Pro chef',
    description: 'Brisk, technique-forward restaurant energy.',
    prompt:
      'Persona: seasoned professional chef. Be brisk and confident, use correct culinary terminology, and keep a focused restaurant-kitchen energy — still friendly, never condescending.',
  },
  {
    key: 'minimal',
    label: 'Just the facts',
    description: 'Minimal chatter, one crisp line per step.',
    prompt:
      'Persona: minimalist. Skip pleasantries and filler. Give crisp, direct instructions — ideally one short line per step — and no small talk.',
  },
  {
    key: 'playful',
    label: 'Playful',
    description: 'Light banter to keep long cooks fun.',
    prompt:
      'Persona: playful and upbeat. Add light humour and the occasional food pun, but never at the expense of clarity.',
  },
  {
    key: 'calm',
    label: 'Calm & soothing',
    description: 'Slow, relaxed, ASMR-style narration.',
    prompt:
      'Persona: calm and soothing. Speak slowly and gently in a relaxed, almost ASMR-like tone, keeping the user unhurried and at ease.',
  },
]

export const CHEF_SKILL_PREFS: ChefOption<ChefSkillPref>[] = [
  {
    key: 'auto',
    label: 'Adaptive',
    description: 'Matches your tracked skills as they grow.',
    prompt:
      'Skill level: adaptive. Match the depth of your explanations to the user skill state above, leaning on the suggested stretch technique.',
  },
  {
    key: 'beginner',
    label: 'Beginner',
    description: 'Explain every term and doneness cue.',
    prompt:
      'Skill level: beginner. Assume little cooking experience — define every technique and cooking term, spell out doneness cues concretely, and flag common mistakes before they happen.',
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    description: 'Assume solid basics; explain the tricky bits.',
    prompt:
      'Skill level: intermediate. Assume solid home-cooking basics — explain only less-common techniques or the suggested stretch technique, and keep routine steps brief.',
  },
  {
    key: 'expert',
    label: 'Expert',
    description: 'Terse and precise; skip the basics.',
    prompt:
      'Skill level: expert. Assume a highly experienced cook — be terse, skip explanations of standard techniques unless asked, and focus on precision, timing, and refinements.',
  },
]

export const CHEF_PACING_OPTIONS: ChefOption<ChefPacing>[] = [
  {
    key: 'step_by_step',
    label: 'Step by step',
    description: 'One step at a time; waits for you.',
    prompt:
      'Pacing: step by step. Present exactly one step at a time and wait for the user to say they are ready before continuing.',
  },
  {
    key: 'hands_free',
    label: 'Hands-free',
    description: 'Built for listening while you cook.',
    prompt:
      'Pacing: hands-free. The user is listening while cooking and not looking at the screen. Keep each reply self-contained and easy to follow by ear, occasionally remind them they can say "next", "back", "repeat", or "timer", and still present one step at a time.',
  },
  {
    key: 'overview_first',
    label: 'Overview first',
    description: 'A game plan up front, then step by step.',
    prompt:
      'Pacing: overview first. In your welcome, give a brief big-picture game plan of the whole recipe (the major phases, not every numbered step) so the user knows what is coming, then still walk through one detailed step at a time when they are ready.',
  },
]

export const DEFAULT_CHEF_PREFERENCES = {
  persona: 'warm',
  skillPref: 'auto',
  pacing: 'step_by_step',
  voiceURI: null,
} as const

export interface ChefPreferences {
  persona: ChefPersona
  skillPref: ChefSkillPref
  pacing: ChefPacing
  voiceURI: string | null
}

/** Read chef preferences off a profile row, falling back to defaults. */
export function chefPreferencesFromProfile(profile: Profile | null): ChefPreferences {
  return {
    persona: profile?.chef_persona ?? DEFAULT_CHEF_PREFERENCES.persona,
    skillPref: profile?.chef_skill_pref ?? DEFAULT_CHEF_PREFERENCES.skillPref,
    pacing: profile?.chef_pacing ?? DEFAULT_CHEF_PREFERENCES.pacing,
    voiceURI: profile?.chef_voice_uri ?? DEFAULT_CHEF_PREFERENCES.voiceURI,
  }
}

/**
 * Prompt lines describing the user's chosen persona / skill level / pacing.
 * Appended after the base coaching rules so they win where tone conflicts.
 */
export function buildChefStyleDirectives(prefs: ChefPreferences): string[] {
  const persona = CHEF_PERSONAS.find(p => p.key === prefs.persona) ?? CHEF_PERSONAS[0]
  const skill = CHEF_SKILL_PREFS.find(s => s.key === prefs.skillPref) ?? CHEF_SKILL_PREFS[0]
  const pacing = CHEF_PACING_OPTIONS.find(p => p.key === prefs.pacing) ?? CHEF_PACING_OPTIONS[0]
  return [
    `CHEF STYLE (the user picked these — they take priority over the general tone above where they conflict):`,
    `- ${persona.prompt}`,
    `- ${skill.prompt}`,
    `- ${pacing.prompt}`,
  ]
}

const PERSONA_KEYS = new Set(CHEF_PERSONAS.map(p => p.key))
const SKILL_KEYS = new Set(CHEF_SKILL_PREFS.map(s => s.key))
const PACING_KEYS = new Set(CHEF_PACING_OPTIONS.map(p => p.key))

export const isChefPersona = (v: unknown): v is ChefPersona =>
  typeof v === 'string' && PERSONA_KEYS.has(v as ChefPersona)
export const isChefSkillPref = (v: unknown): v is ChefSkillPref =>
  typeof v === 'string' && SKILL_KEYS.has(v as ChefSkillPref)
export const isChefPacing = (v: unknown): v is ChefPacing =>
  typeof v === 'string' && PACING_KEYS.has(v as ChefPacing)
