'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Email sign-in with a typed one-time code (not a magic link): a link opens in
// the phone's browser instead of the installed PWA, and its PKCE verifier only
// lives in the browser that asked for it. The email also carries a link, which
// lands on /auth/callback?next=… and works when opened in this same browser.
// NOTE: the code only appears in the email once the Supabase templates include
// {{ .Token }} — that needs custom SMTP; until then the email is link-only.

const SENT_KEY = 'preptable-email-code-sent'
const CODE_TTL_MS = 60 * 60 * 1000 // matches the project's mailer_otp_exp (1h)

type SentState = { email: string; sentAt: number }

function loadSent(): SentState | null {
  try {
    const raw = sessionStorage.getItem(SENT_KEY)
    const sent = raw ? (JSON.parse(raw) as SentState) : null
    return sent && Date.now() - sent.sentAt < CODE_TTL_MS ? sent : null
  } catch { return null }
}

function saveSent(sent: SentState | null): void {
  try {
    if (sent) sessionStorage.setItem(SENT_KEY, JSON.stringify(sent))
    else sessionStorage.removeItem(SENT_KEY)
  } catch {}
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailCodeForm({
  onSignedIn,
  onBeforeAuth,
  disabled = false,
  sendLabel = 'Continue with email',
  next = '/',
}: {
  onSignedIn: () => void
  // Where the email's fallback link lands after /auth/callback signs the user in.
  next?: string
  // Runs right before sending and before verifying, so callers can stash state
  // that has to survive the sign-in (e.g. the onboarding handle).
  onBeforeAuth?: () => void
  disabled?: boolean
  sendLabel?: string
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  // iOS often reloads a PWA after a trip to the mail app — resume at the code
  // step rather than making the user burn another (rate-limited) email.
  useEffect(() => {
    const sent = loadSent()
    if (sent) {
      setEmail(sent.email)
      setPhase('code')
    }
  }, [])

  const trimmedEmail = email.trim().toLowerCase()
  const emailReady = EMAIL_RE.test(trimmedEmail)

  const sendCode = async () => {
    if (!emailReady || busy) return
    setBusy(true)
    setError(null)
    onBeforeAuth?.()
    const { error } = await createClient().auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    saveSent({ email: trimmedEmail, sentAt: Date.now() })
    setResent(phase === 'code')
    setCode('')
    setPhase('code')
  }

  const verifyCode = async () => {
    if (!code || busy) return
    setBusy(true)
    setError(null)
    onBeforeAuth?.()
    const { error } = await createClient().auth.verifyOtp({
      email: trimmedEmail,
      token: code,
      type: 'email',
    })
    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }
    saveSent(null)
    onSignedIn()
  }

  const changeEmail = () => {
    saveSent(null)
    setPhase('email')
    setCode('')
    setError(null)
    setResent(false)
  }

  if (phase === 'code') {
    return (
      <form
        onSubmit={e => { e.preventDefault(); verifyCode() }}
        className="flex flex-col gap-3"
      >
        <p className="px-1 text-sm text-gray-500">
          Check <span className="font-medium text-gray-700">{trimmedEmail}</span>. Enter the code from the email, or open its link on this device.
          {resent && ' Sent again.'}
        </p>
        <div>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            autoFocus
            aria-label="Sign-in code"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tracking-widest text-gray-900 outline-none placeholder:tracking-normal placeholder:text-gray-400 focus:ring-2 focus:ring-brand/40"
          />
          {error && (
            <p className="mt-1.5 px-1 text-xs font-medium text-red-500">{error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || !code || busy}
          className="w-full h-14 rounded-full bg-brand hover:bg-brand/90 text-white text-base font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {busy ? 'Checking…' : 'Verify code'}
        </button>
        <div className="flex justify-between px-1 text-xs font-medium text-gray-500">
          <button type="button" onClick={changeEmail} className="hover:text-gray-700">
            Use a different email
          </button>
          <button type="button" onClick={sendCode} disabled={busy} className="hover:text-gray-700 disabled:opacity-50">
            Resend email
          </button>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); sendCode() }}
      className="flex flex-col gap-3"
    >
      <div>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Email address"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-brand/40"
        />
        {error && (
          <p className="mt-1.5 px-1 text-xs font-medium text-red-500">{error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || !emailReady || busy}
        className="w-full h-14 rounded-full bg-brand hover:bg-brand/90 text-white text-base font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {busy ? 'Sending…' : sendLabel}
      </button>
    </form>
  )
}

/** "or" rule between the Google button and the email form. */
export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-gray-400">
      <div className="h-px flex-1 bg-gray-200" />
      or
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}
