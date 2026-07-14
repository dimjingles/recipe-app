'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CookingLoader } from '@/components/cooking-loader'

/**
 * Cold-start splash. Lives in the root layout, so it mounts once per full page
 * load (not on client-side navigations) and covers the app while it boots and
 * hydrates. It shows a fun cooking animation, then fades out.
 */
export function AppSplash() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show')

  useEffect(() => {
    // Keep it on screen briefly so the animation reads as intentional rather
    // than a flash, then fade out and unmount.
    const fade = setTimeout(() => setPhase('fade'), 750)
    const gone = setTimeout(() => setPhase('gone'), 750 + 500)
    return () => {
      clearTimeout(fade)
      clearTimeout(gone)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-500',
        phase === 'fade' ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <CookingLoader size="lg" label="" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-heading text-2xl font-bold text-foreground">PrepTable</span>
          <span className="text-sm text-muted-foreground">Warming up the kitchen…</span>
        </div>
      </div>
    </div>
  )
}
