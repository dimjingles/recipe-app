import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ── SVG spot illustrations ──────────────────────────────────────────────── */

export function RecipeBookIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="8" width="38" height="48" rx="4" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <rect x="14" y="16" width="26" height="3" rx="1.5" fill="var(--brand)" opacity="0.5"/>
      <rect x="14" y="23" width="20" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.4"/>
      <rect x="14" y="28" width="24" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.4"/>
      <rect x="14" y="33" width="16" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.4"/>
      <circle cx="38" cy="42" r="8" fill="var(--brand)" opacity="0.15"/>
      <path d="M34 42c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="var(--brand)" opacity="0.6"/>
      <path d="M38 40v4M36 42h4" stroke="var(--brand-foreground)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function CalendarIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="8" y="14" width="48" height="42" rx="6" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <rect x="8" y="14" width="48" height="14" rx="6" fill="var(--brand)" opacity="0.2"/>
      <rect x="8" y="20" width="48" height="8" fill="var(--brand)" opacity="0.2"/>
      <circle cx="22" cy="10" r="3" fill="var(--brand)"/>
      <circle cx="42" cy="10" r="3" fill="var(--brand)"/>
      <rect x="16" y="36" width="8" height="7" rx="2" fill="var(--brand)" opacity="0.4"/>
      <rect x="28" y="36" width="8" height="7" rx="2" fill="var(--brand)" opacity="0.4"/>
      <rect x="40" y="36" width="8" height="7" rx="2" fill="var(--brand)" opacity="0.4"/>
    </svg>
  )
}

export function BasketIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 28L28 16M44 28L36 16" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M10 28h44l-6 24H16L10 28z" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <path d="M10 28h44" stroke="var(--brand)" strokeWidth="2"/>
      <circle cx="26" cy="40" r="2" fill="var(--brand)" opacity="0.5"/>
      <circle cx="32" cy="44" r="2" fill="var(--brand)" opacity="0.5"/>
      <circle cx="38" cy="40" r="2" fill="var(--brand)" opacity="0.5"/>
    </svg>
  )
}

export function CameraIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="6" y="20" width="52" height="36" rx="6" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <path d="M22 20l4-8h12l4 8" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <circle cx="32" cy="38" r="10" stroke="var(--brand)" strokeWidth="2" fill="var(--brand)" opacity="0.1"/>
      <circle cx="32" cy="38" r="6" fill="var(--brand)" opacity="0.3"/>
      <circle cx="32" cy="38" r="3" fill="var(--brand)" opacity="0.6"/>
      <circle cx="44" cy="28" r="2" fill="var(--brand)" opacity="0.5"/>
    </svg>
  )
}

export function SpoonIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="20" r="10" fill="var(--brand-subtle)" stroke="var(--brand)" strokeWidth="2"/>
      <rect x="30" y="28" width="4" height="26" rx="2" fill="var(--brand)" opacity="0.4"/>
      <path d="M27 16c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

/* ── EmptyState component ────────────────────────────────────────────────── */

interface EmptyStateProps {
  illustration?: ReactNode
  emoji?: string
  title: string
  description?: string
  action?: ReactNode
  variant?: 'default' | 'dashed'
  className?: string
}

export function EmptyState({
  illustration,
  emoji,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        variant === 'dashed' &&
          'bg-card rounded-2xl border border-dashed border-border',
        className,
      )}
    >
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : emoji ? (
        <p className="text-4xl mb-3">{emoji}</p>
      ) : null}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
