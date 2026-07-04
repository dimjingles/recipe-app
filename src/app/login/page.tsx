'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChefHat } from 'lucide-react'

export default function LoginPage() {
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

        {sent ? (
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
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Welcome back</h2>
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
            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <button
                onClick={() => { window.location.href = '/onboarding' }}
                className="text-sm text-orange-600 hover:underline"
              >
                New here? Get started →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
