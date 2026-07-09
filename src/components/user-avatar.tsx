import { cn } from '@/lib/utils'

/** Consistent avatar: photo if present, otherwise a coloured initial. Server-safe. */
export function UserAvatar({
  name,
  src,
  size = 40,
  className,
}: {
  name?: string | null
  src?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase()
  const dimensions = { width: size, height: size }

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        style={dimensions}
        className={cn('shrink-0 rounded-full bg-muted object-cover', className)}
      />
    )
  }

  return (
    <div
      style={{ ...dimensions, fontSize: Math.round(size * 0.42) }}
      className={cn('grid shrink-0 place-items-center rounded-full bg-brand-subtle font-bold text-brand', className)}
      aria-hidden
    >
      {initial}
    </div>
  )
}
