'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface CookTimer {
  id: string
  label: string
  durationMs: number
  remainingMs: number
  running: boolean
  /** Wall-clock time (Date.now) at which a running timer hits zero. */
  endAt: number
}

let seq = 0
const nextId = () => `t${Date.now()}_${seq++}`

/**
 * Owns the set of active cook-mode timers. Timers live above the step view so
 * they keep counting down as the user moves between steps. Uses wall-clock
 * math (Date.now) so a backgrounded / throttled tab still shows the correct
 * remaining time when it returns.
 */
export function useCookTimers() {
  const [timers, setTimers] = useState<CookTimer[]>([])

  // Latest snapshot for the interval callback without re-arming it each tick.
  const timersRef = useRef(timers)
  timersRef.current = timers

  const anyRunning = timers.some(t => t.running)

  useEffect(() => {
    if (!anyRunning) return
    const iv = setInterval(() => {
      const now = Date.now()
      const finished: CookTimer[] = []
      const next = timersRef.current.map(t => {
        if (!t.running) return t
        const remainingMs = Math.max(0, t.endAt - now)
        if (remainingMs === 0) {
          finished.push(t)
          return { ...t, remainingMs: 0, running: false }
        }
        return { ...t, remainingMs }
      })
      setTimers(next)
      finished.forEach(fireAlarm)
    }, 250)
    return () => clearInterval(iv)
  }, [anyRunning])

  const startTimer = (durationMs: number, label: string) => {
    setTimers(prev => [
      ...prev,
      {
        id: nextId(),
        label,
        durationMs,
        remainingMs: durationMs,
        running: true,
        endAt: Date.now() + durationMs,
      },
    ])
  }

  const toggleTimer = (id: string) => {
    setTimers(prev =>
      prev.map(t => {
        if (t.id !== id) return t
        if (t.running) {
          // Pause: freeze remaining from the live clock.
          return { ...t, running: false, remainingMs: Math.max(0, t.endAt - Date.now()) }
        }
        // Resume (or restart a finished timer).
        const remainingMs = t.remainingMs > 0 ? t.remainingMs : t.durationMs
        return { ...t, running: true, remainingMs, endAt: Date.now() + remainingMs }
      }),
    )
  }

  const dismissTimer = (id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id))
  }

  return { timers, startTimer, toggleTimer, dismissTimer }
}

// ── Alarm ──────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function fireAlarm(timer: CookTimer) {
  toast.success(`⏰ Timer done — ${timer.label}`)

  // Haptics where available (Android Chrome).
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([200, 100, 200, 100, 200])
  }

  // Short triple beep via Web Audio. The AudioContext was unlocked by the tap
  // that started the timer, so playback is allowed.
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    const ctx = audioCtx!
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const start = now + i * 0.35
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    }
  } catch {
    /* audio not available — toast + vibrate already fired */
  }
}
