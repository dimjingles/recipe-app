'use client'

import { useEffect, useState } from 'react'
import { useIsRestoring } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { CookingLoader } from '@/components/cooking-loader'

/**
 * Cold-start splash. Lives in the root layout, so it mounts once per full page
 * load (not on client-side navigations) and covers the app while it boots:
 * until React has hydrated and the persisted query cache has been restored, so
 * the first thing revealed is real data. There's no minimum display time — it
 * used to hold for a fixed 750ms (+500ms fade) even with a warm cache.
 */
const FADE_MS = 200

export function AppSplash() {
  const isRestoring = useIsRestoring()
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show')

  useEffect(() => {
    if (isRestoring) return
    setPhase('fade')
    const gone = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(gone)
  }, [isRestoring])

  if (phase === 'gone') return null

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-200',
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
