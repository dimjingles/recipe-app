'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChefHat } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })
    // If OAuth redirect didn't navigate away (e.g. popup blocker), reset loading
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-subtle to-cooking-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-brand rounded-2xl p-4">
              <ChefHat className="w-10 h-10 text-brand-foreground" />
            </div>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">PrepTable</h1>
          <p className="text-muted-foreground mt-2">Your personal recipe &amp; meal planner</p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-14 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center gap-3 text-gray-700 font-semibold text-base hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.38c-.23 1.24-.95 2.29-2.01 2.99v2.48h3.25c1.9-1.75 3-4.33 3-7.26z" fill="#4285F4"/>
      <path d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.22-2.5c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.14H1.08v2.58C2.72 17.76 6.1 20 10 20z" fill="#34A853"/>
      <path d="M4.39 11.89A6.02 6.02 0 0 1 4.04 10c0-.65.11-1.29.35-1.89V5.53H1.08A10 10 0 0 0 0 10c0 1.61.38 3.13 1.08 4.47l3.31-2.58z" fill="#FBBC05"/>
      <path d="M10 3.98c1.47 0 2.8.51 3.84 1.5l2.87-2.87C14.96.9 12.7 0 10 0 6.1 0 2.72 2.24 1.08 5.53l3.31 2.58C5.18 5.74 7.39 3.98 10 3.98z" fill="#EA4335"/>
    </svg>
  )
}
