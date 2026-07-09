'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'timer'

/**
 * Hands-free control for Guided Cook Mode via the Web Speech API.
 *
 * Voice is strictly opt-in: nothing starts until `toggle()` is called, so the
 * browser only prompts for the microphone when the user asks for it. On
 * browsers without SpeechRecognition (Firefox, some WebViews) `supported` is
 * false and the caller hides the control entirely.
 *
 * Recognised phrases → command:
 *   "next" / "next step" / "continue"        → next
 *   "back" / "previous" / "go back"          → back
 *   "repeat" / "say that again" / "again"    → repeat
 *   "start timer" / "set a timer" / "timer"  → timer
 */
export function useVoiceControl(onCommand: (cmd: VoiceCommand) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)
  // Keep the latest handler without restarting recognition.
  const commandRef = useRef(onCommand)
  commandRef.current = onCommand

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) return
    setSupported(true)

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result.isFinal) continue
        const cmd = matchCommand(result[0].transcript)
        if (cmd) commandRef.current(cmd)
      }
    }

    // Chrome stops recognition periodically; restart while the user wants it on.
    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start()
        } catch {
          /* already started */
        }
      } else {
        setListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      // Permission denied or unrecoverable — stop listening quietly.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningRef.current = false
        setListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      listeningRef.current = false
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
      recognitionRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (listeningRef.current) {
      listeningRef.current = false
      setListening(false)
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
    } else {
      listeningRef.current = true
      setListening(true)
      try {
        recognition.start()
      } catch {
        /* start() throws if already running — safe to ignore */
      }
    }
  }, [])

  return { supported, listening, toggle }
}

function matchCommand(raw: string): VoiceCommand | null {
  const t = raw.toLowerCase().trim()
  if (/\b(next|continue|forward|go on)\b/.test(t)) return 'next'
  if (/\b(back|previous|prev|go back)\b/.test(t)) return 'back'
  if (/\b(repeat|again|say that again|read( it)? again)\b/.test(t)) return 'repeat'
  if (/\b(timer|set a timer|start (a )?timer)\b/.test(t)) return 'timer'
  return null
}
