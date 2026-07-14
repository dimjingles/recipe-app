'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Playful status lines that rotate while the kitchen "cooks". */
export const COOKING_MESSAGES = [
  'Preheating the pan…',
  'Chopping the ingredients…',
  'Adding a pinch of salt…',
  'Stirring the pot…',
  'Letting the flavors mingle…',
  'Plating it up…',
]

const SIZES = {
  sm: { stage: 'h-14 w-14', pot: 'text-3xl', steam: 'h-3 w-1', burner: 'h-2.5 w-10' },
  md: { stage: 'h-24 w-24', pot: 'text-5xl', steam: 'h-4 w-1.5', burner: 'h-3.5 w-16' },
  lg: { stage: 'h-32 w-32', pot: 'text-7xl', steam: 'h-6 w-2', burner: 'h-4 w-24' },
} as const

interface CookingLoaderProps {
  /** Rotating status lines. Pass a single-item array to keep the text fixed. */
  messages?: string[]
  /** A fixed label shown under the animation (overrides rotating messages). */
  label?: string
  size?: keyof typeof SIZES
  className?: string
}

/**
 * A fun, on-brand cooking animation: a bobbing pot over a pulsing burner with
 * rising steam, paired with rotating cooking messages. Used for page loads and
 * multi-second AI recipe-creation waits. Honors prefers-reduced-motion via the
 * global animation-duration override in globals.css.
 */
export function CookingLoader({ messages = COOKING_MESSAGES, label, size = 'md', className }: CookingLoaderProps) {
  const [i, setI] = useState(0)
  const rotate = !label && messages.length > 1

  useEffect(() => {
    if (!rotate) return
    const id = setInterval(() => setI(p => (p + 1) % messages.length), 1800)
    return () => clearInterval(id)
  }, [rotate, messages.length])

  const s = SIZES[size]
  const text = label ?? messages[i]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 text-center', className)}>
      <div className={cn('relative flex items-end justify-center', s.stage)}>
        {/* rising steam wisps */}
        <div className="absolute left-1/2 top-0 flex -translate-x-1/2 gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(n => (
            <span
              key={n}
              className={cn('rounded-full bg-muted-foreground/40 animate-steam', s.steam)}
              style={{ animationDelay: `${n * 0.45}s` }}
            />
          ))}
        </div>

        {/* warm burner glow under the pot */}
        <span
          className={cn('absolute bottom-1 left-1/2 rounded-full bg-brand/40 blur-md animate-burner-pulse', s.burner)}
          aria-hidden="true"
        />

        {/* the pot */}
        <span
          className={cn('relative animate-pot-bob leading-none', s.pot)}
          role="img"
          aria-label="Cooking"
        >
          🍲
        </span>
      </div>

      {text && (
        <p key={text} className="animate-fade-in text-sm font-medium text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  )
}
