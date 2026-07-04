'use client'

import { cn } from '@/lib/utils'

interface OptionCardProps {
  icon?: React.ReactNode
  label: string
  description?: string
  selected: boolean
  onClick: () => void
  className?: string
}

export default function OptionCard({
  icon,
  label,
  description,
  selected,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 active:scale-[0.98]',
        selected
          ? 'border-orange-500 bg-orange-50'
          : 'border-gray-200 bg-white hover:border-gray-300',
        className
      )}
    >
      {icon && (
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg',
          selected ? 'bg-orange-100' : 'bg-gray-100'
        )}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-semibold text-base leading-tight',
          selected ? 'text-gray-900' : 'text-gray-800'
        )}>
          {label}
        </p>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {/* Radio indicator */}
      <div className={cn(
        'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
        selected ? 'border-orange-500' : 'border-gray-300'
      )}>
        {selected && (
          <div className="w-3.5 h-3.5 rounded-full bg-orange-500" />
        )}
      </div>
    </button>
  )
}
