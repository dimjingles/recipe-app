'use client'

import { useEffect, useRef } from 'react'

/**
 * Keep the screen awake while Guided Cook Mode is open, using the Screen Wake
 * Lock API where the browser supports it. No-ops silently on unsupported
 * browsers (iOS Safari < 16.4, older Android WebViews) so cook mode still works.
 *
 * The lock is re-acquired when the tab becomes visible again, because browsers
 * release it automatically when the page is hidden.
 */
export function useWakeLock(active = true) {
  const sentinelRef = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    if (!nav.wakeLock) return

    let released = false

    const acquire = async () => {
      try {
        sentinelRef.current = await nav.wakeLock!.request('screen')
      } catch {
        // Request can reject (e.g. low battery, not visible) — that's fine.
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinelRef.current?.release().catch(() => {})
      sentinelRef.current = null
    }
  }, [active])
}
