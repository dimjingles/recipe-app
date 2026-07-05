import { cn } from '@/lib/utils'

interface ShimmerProps {
  className?: string
}

/** Branded warm shimmer — replaces raw animate-pulse gray boxes. */
export function Shimmer({ className }: ShimmerProps) {
  return (
    <div
      className={cn('bg-shimmer rounded-xl', className)}
      aria-hidden="true"
    />
  )
}
