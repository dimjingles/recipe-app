export const CUISINE_EMOJI: Record<string, string> = {
  Italian: '🍝',
  Mexican: '🌮',
  Japanese: '🍣',
  Chinese: '🥡',
  Indian: '🍛',
  French: '🥐',
  American: '🍔',
  Thai: '🍜',
  Mediterranean: '🫙',
  Korean: '🥢',
  Greek: '🫒',
  Spanish: '🥘',
  Vietnamese: '🍲',
  'Middle Eastern': '🧆',
  Other: '🍽️',
}

export function getCuisineEmoji(cuisine?: string | null): string {
  if (!cuisine) return '🍽️'
  return CUISINE_EMOJI[cuisine] ?? '🍽️'
}
