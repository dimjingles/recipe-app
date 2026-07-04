'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChefHat, ChevronLeft } from 'lucide-react'

type Phase = 'landing' | 'email'
type Mode = 'signup' | 'signin'

export default function LoginPage() {
  const [phase, setPhase] = useState<Phase>('landing')
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const nextParam = new URLSearchParams(window.location.search).get('next') || '/'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  const enterEmailPhase = (selectedMode: Mode) => {
    setMode(selectedMode)
    setPhase('email')
    setEmail('')
    setError('')
    setSent(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-orange-500 rounded-2xl p-4">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mise en Place</h1>
          <p className="text-gray-500 mt-2">Your personal recipe & meal planner</p>
        </div>

        {phase === 'landing' ? (
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => enterEmailPhase('signup')}
              className="w-full h-14 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-full"
            >
              Get started
            </Button>
            <Button
              onClick={() => enterEmailPhase('signin')}
              variant="outline"
              className="w-full h-14 text-base font-semibold rounded-full border-gray-300 text-gray-700 hover:bg-white"
            >
              Already have an account? Sign in
            </Button>
          </div>
        ) : sent ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-orange-600 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-8">
            <button
              onClick={() => setPhase('landing')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 -ml-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700 font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? 'Sending...' : 'Send magic link ✨'}
              </Button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-4">
              No password required. We'll email you a sign-in link.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
