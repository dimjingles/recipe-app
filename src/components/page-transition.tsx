'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Wraps page content in a fade-in animation keyed to the current pathname.
 * Re-mounts (and re-runs the animation) on every route change.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  )
}
