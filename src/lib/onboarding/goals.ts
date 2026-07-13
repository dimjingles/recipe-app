const GOAL_LABELS: Record<string, string> = {
  healthier: 'eating healthier',
  save_time: 'saving time in the kitchen',
  save_money: 'saving money on food',
  learn: 'learning to cook',
  reduce_waste: 'reducing food waste',
}

export function toggleGoalSelection(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter(goal => goal !== value)
    : [...current, value]
}

export function buildGoalCommitLabel(goals: string[]): string {
  const labels = goals.map(goal => GOAL_LABELS[goal]).filter(Boolean)
  if (labels.length === 0) return 'reaching your cooking goals'
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export function normalizePrimaryGoals(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((goal): goal is string => typeof goal === 'string' && goal.length > 0)
  }
  return typeof value === 'string' && value.length > 0 ? [value] : []
}
