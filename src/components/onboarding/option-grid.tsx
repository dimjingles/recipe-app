'use client'

import { cn } from '@/lib/utils'

interface OptionGridItem {
  value: string
  label: string
  emoji?: string
}

interface OptionGridProps {
  options: OptionGridItem[]
  selected: string[]
  onToggle: (value: string) => void
  columns?: 2 | 3
}

export default function OptionGrid({
  options,
  selected,
  onToggle,
  columns = 2,
}: OptionGridProps) {
  return (
    <div className={cn(
      'grid gap-3',
      columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
    )}>
      {options.map(({ value, label, emoji }) => {
        const isSelected = selected.includes(value)
        return (
          <button
            key={value}
            onClick={() => onToggle(value)}
            className={cn(
              'flex items-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.97]',
              isSelected
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            {emoji && <span className="text-xl flex-shrink-0">{emoji}</span>}
            <span className={cn(
              'font-medium text-sm leading-tight',
              isSelected ? 'text-orange-700' : 'text-gray-700'
            )}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
