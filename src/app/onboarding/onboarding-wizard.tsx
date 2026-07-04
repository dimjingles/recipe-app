'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Users, User, Heart, Clock, DollarSign,
  BookOpen, Leaf, ChefHat,
  ChevronLeft, Sprout,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import OnboardingShell from '@/components/onboarding/shell'
import OptionCard from '@/components/onboarding/option-card'
import OptionGrid from '@/components/onboarding/option-grid'

// Steps 0–13 use the shell; 14 = commit, 15 = loading (auto), 16 = create account, 17 = finishing
const TOTAL_SHELL_STEPS = 14

// ── localStorage persistence ──────────────────────────────────────────────────

const STORAGE_KEY = 'mep-onboarding-v1'

type StoredState = {
  answers: Answers
  step: number
  pendingSubmit?: boolean
}

function saveToStorage(data: StoredState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function loadFromStorage(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredState) : null
  } catch { return null }
}

function clearStorage(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Answers = {
  household_size: string
  cook_frequency: string
  referral_source: string
  primary_goal: string
  diet: string
  allergies: string[]
  favorite_cuisines: string[]
  skill_level: string
  meal_reminders: boolean
}

const INITIAL_ANSWERS: Answers = {
  household_size: '',
  cook_frequency: '',
  referral_source: '',
  primary_goal: '',
  diet: '',
  allergies: [],
  favorite_cuisines: [],
  skill_level: '',
  meal_reminders: false,
}

// ─── Option data ──────────────────────────────────────────────────────────────

const HOUSEHOLD_OPTIONS = [
  { value: 'just_me', label: 'Just me', description: 'Cooking for one', icon: <User className="w-5 h-5 text-gray-600" /> },
  { value: 'couple', label: 'Me & a partner', description: 'Cooking for two', icon: <Heart className="w-5 h-5 text-gray-600" /> },
  { value: 'family', label: 'Family', description: '3 or more people', icon: <Users className="w-5 h-5 text-gray-600" /> },
]

const FREQUENCY_OPTIONS = [
  { value: '0-2', label: '0 – 2', description: 'Cooking now and then', icon: <span className="text-sm">🌱</span> },
  { value: '3-5', label: '3 – 5', description: 'A few times a week', icon: <span className="text-sm">🍳</span> },
  { value: '6+', label: '6+', description: 'Dedicated home chef', icon: <span className="text-sm">👨‍🍳</span> },
]

const REFERRAL_OPTIONS = [
  { value: 'instagram', label: 'Instagram', icon: <span className="text-sm">📸</span> },
  { value: 'tiktok', label: 'TikTok', icon: <span className="text-sm">🎵</span> },
  { value: 'google', label: 'Google', icon: <span className="text-sm">🔍</span> },
  { value: 'friend', label: 'Friend or family', icon: <span className="text-sm">👥</span> },
  { value: 'app_store', label: 'App Store', icon: <span className="text-sm">📱</span> },
  { value: 'youtube', label: 'YouTube', icon: <span className="text-sm">▶️</span> },
  { value: 'other', label: 'Other', icon: <span className="text-sm">💬</span> },
]

const GOAL_OPTIONS = [
  { value: 'healthier', label: 'Eat healthier', description: 'Better nutrition at home', icon: <Leaf className="w-5 h-5 text-green-600" /> },
  { value: 'save_time', label: 'Save time', description: 'Faster meals & meal prep', icon: <Clock className="w-5 h-5 text-blue-600" /> },
  { value: 'save_money', label: 'Save money', description: 'Less takeout, more home cooking', icon: <DollarSign className="w-5 h-5 text-yellow-600" /> },
  { value: 'learn', label: 'Learn to cook', description: 'Build new skills & confidence', icon: <BookOpen className="w-5 h-5 text-purple-600" /> },
  { value: 'reduce_waste', label: 'Reduce waste', description: 'Use what\'s in the fridge', icon: <Sprout className="w-5 h-5 text-emerald-600" /> },
]

const DIET_OPTIONS = [
  { value: 'balanced', label: 'Balanced', description: 'A bit of everything', icon: <span className="text-sm">⚖️</span> },
  { value: 'whole_food', label: 'Whole-food focus', description: 'Minimally processed', icon: <span className="text-sm">🥦</span> },
  { value: 'mediterranean', label: 'Mediterranean', description: 'Olive oil, fish, veg', icon: <span className="text-sm">🫒</span> },
  { value: 'flexitarian', label: 'Flexitarian', description: 'Mostly plant-based', icon: <span className="text-sm">🌿</span> },
  { value: 'pescatarian', label: 'Pescatarian', description: 'Fish, no other meat', icon: <span className="text-sm">🐟</span> },
  { value: 'vegetarian', label: 'Vegetarian', description: 'No meat', icon: <span className="text-sm">🥗</span> },
  { value: 'vegan', label: 'Vegan', description: 'No animal products', icon: <span className="text-sm">🌱</span> },
  { value: 'low_carb', label: 'Low-carb', description: 'Fewer grains & starches', icon: <span className="text-sm">🥩</span> },
]

const ALLERGY_OPTIONS = [
  { value: 'gluten', label: 'Gluten', emoji: '🌾' },
  { value: 'dairy', label: 'Dairy', emoji: '🥛' },
  { value: 'nuts', label: 'Tree nuts', emoji: '🥜' },
  { value: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { value: 'eggs', label: 'Eggs', emoji: '🥚' },
  { value: 'soy', label: 'Soy', emoji: '🫘' },
  { value: 'meat', label: 'Meat', emoji: '🥩' },
  { value: 'none', label: 'None', emoji: '✅' },
]

const CUISINE_OPTIONS = [
  { value: 'italian', label: 'Italian', emoji: '🍝' },
  { value: 'japanese', label: 'Japanese', emoji: '🍜' },
  { value: 'chinese', label: 'Chinese', emoji: '🥢' },
  { value: 'mexican', label: 'Mexican', emoji: '🌮' },
  { value: 'indian', label: 'Indian', emoji: '🍛' },
  { value: 'thai', label: 'Thai', emoji: '🌶️' },
  { value: 'french', label: 'French', emoji: '🥐' },
  { value: 'american', label: 'American', emoji: '🍔' },
  { value: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { value: 'korean', label: 'Korean', emoji: '🍱' },
  { value: 'vietnamese', label: 'Vietnamese', emoji: '🍲' },
  { value: 'greek', label: 'Greek', emoji: '🥗' },
  { value: 'spanish', label: 'Spanish', emoji: '🥘' },
  { value: 'middle_eastern', label: 'Middle Eastern', emoji: '🧆' },
  { value: 'filipino', label: 'Filipino', emoji: '🍖' },
  { value: 'moroccan', label: 'Moroccan', emoji: '🫕' },
]

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', description: 'I burn toast sometimes', icon: <span className="text-sm">🌱</span> },
  { value: 'getting_there', label: 'Getting there', description: 'I know the basics', icon: <span className="text-sm">🍳</span> },
  { value: 'confident', label: 'Confident', description: 'I can follow any recipe', icon: <span className="text-sm">👨‍🍳</span> },
  { value: 'pro', label: 'Pro', description: 'I improvise freely', icon: <span className="text-sm">⭐</span> },
]

const TESTIMONIALS = [
  {
    name: 'Sarah K.',
    rating: 5,
    text: 'I finally stopped defaulting to takeout. The AI recipe suggestions are spot-on for what I actually have at home.',
  },
  {
    name: 'Mark T.',
    rating: 5,
    text: 'The weekly planner changed everything. I save time AND money — meal prep used to feel impossible.',
  },
]

// Confetti pieces for the commit celebration
const CONFETTI_PIECES = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  color: ['#f97316', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][i % 6],
  left: `${(i * 8.7 + 3) % 96}%`,
  animDelay: `${(i * 0.045) % 0.7}s`,
  animDuration: `${0.9 + (i * 0.035) % 0.7}s`,
  size: `${8 + (i % 3) * 4}px`,
}))

const GOAL_LABELS: Record<string, string> = {
  healthier: 'eating healthier',
  save_time: 'saving time in the kitchen',
  save_money: 'saving money on food',
  learn: 'learning to cook',
  reduce_waste: 'reducing food waste',
}

// ── Shared loading visual ─────────────────────────────────────────────────────

function DarkLoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
      <p className="text-white text-xl font-medium tracking-wide">{message}</p>
      <div className="relative w-20 h-20">
        <svg className="w-full h-full animate-spin" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36"
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 36 * 0.25} ${2 * Math.PI * 36 * 0.75}`}
            transform="rotate(-90 40 40)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-white" />
        </div>
      </div>
    </div>
  )
}

// ── Google logo ───────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingWizard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [step, setStep] = useState(-1)
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS)

  // Commit button state
  const [holdProgress, setHoldProgress] = useState(0)
  const [committed, setCommitted] = useState(false)
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  // ── Hydrate from localStorage on mount ──────────────────────────────────────
  useEffect(() => {
    const stored = loadFromStorage()

    if (stored?.pendingSubmit && isAuthenticated) {
      // Returned from Google OAuth successfully → auto-flush answers to DB
      setAnswers(stored.answers)
      setStep(17)
    } else if (stored?.pendingSubmit) {
      // OAuth wasn't completed (user closed the Google popup / cancelled) → show account step
      setAnswers(stored.answers)
      setStep(16)
    } else if (stored?.step >= 0 && stored.step <= 13) {
      // Mid-flow page refresh → restore progress
      setAnswers(stored.answers)
      setStep(stored.step)
    } else if (isAuthenticated) {
      // Already signed in, no saved progress → skip welcome screen
      setStep(0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist question steps to localStorage ───────────────────────────────
  useEffect(() => {
    if (step >= 0 && step <= 13) {
      saveToStorage({ answers, step })
    }
  }, [answers, step])

  const goNext = () => setStep(s => s + 1)
  const goBack = () => setStep(s => Math.max(0, s - 1))

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleArray = (key: 'allergies' | 'favorite_cuisines', value: string) => {
    setAnswers(prev => {
      const arr = prev[key]
      // 'none' for allergies clears other selections
      if (key === 'allergies' && value === 'none') {
        return { ...prev, [key]: arr.includes('none') ? [] : ['none'] }
      }
      const without = arr.filter(v => v !== 'none')
      return {
        ...prev,
        [key]: without.includes(value)
          ? without.filter(v => v !== value)
          : [...without, value],
      }
    })
  }

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return !!answers.household_size
      case 1: return !!answers.cook_frequency
      case 2: return !!answers.referral_source
      case 3: return true   // value-prop graph
      case 4: return !!answers.primary_goal
      case 5: return !!answers.diet
      case 6: return true   // allergies optional
      case 7: return answers.favorite_cuisines.length > 0
      case 8: return !!answers.skill_level
      default: return true
    }
  }

  // Notifications step handler
  const handleNotificationRequest = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission()
        set('meal_reminders', perm === 'granted')
      } catch {
        set('meal_reminders', false)
      }
    }
    goNext()
  }

  // Commit tap-and-hold → advances to step 15 (loading screen)
  const startHold = () => {
    if (committed) return
    holdIntervalRef.current = setInterval(() => {
      setHoldProgress(prev => {
        const next = prev + 2   // 50 ticks × 30ms = ~1.5s
        if (next >= 100) {
          clearInterval(holdIntervalRef.current!)
          setCommitted(true)
          setTimeout(() => setStep(15), 1800)
          return 100
        }
        return next
      })
    }, 30)
  }

  const stopHold = () => {
    if (committed) return
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
    setHoldProgress(0)
  }

  // Step 15: auto-advance to account creation after loading animation
  useEffect(() => {
    if (step !== 15) return
    const timer = setTimeout(() => setStep(16), 1800)
    return () => clearTimeout(timer)
  }, [step])

  // Step 16: Google OAuth → kick off sign-up, buffer answers + flag
  const handleCreateAccount = async () => {
    saveToStorage({ answers, step: 13, pendingSubmit: true })
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })
  }

  // Welcome step sign-in (returning users, skips onboarding)
  const handleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })
  }

  // Step 17: flush buffered answers to DB, then navigate to app
  useEffect(() => {
    if (step !== 17 || submittedRef.current) return
    submittedRef.current = true

    // Prefer stored answers (they survived the OAuth redirect)
    const stored = loadFromStorage()
    const submittingAnswers = stored?.answers ?? answers

    fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submittingAnswers),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed (${res.status})`)
        }
        clearStorage()
        window.location.href = '/'
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        toast.error(message + ' — please try again')
        submittedRef.current = false
        setStep(16)   // back to account step
      })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Welcome screen (step -1) ───────────────────────────────────────────────
  if (step === -1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-500 rounded-2xl p-4">
                <ChefHat className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Mise en Place</h1>
            <p className="text-gray-500 mt-2">Your personal recipe &amp; meal planner</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep(0)}
              className="w-full h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-base font-semibold transition-colors active:scale-[0.98]"
            >
              Get started
            </button>
            <button
              onClick={handleSignIn}
              className="w-full h-14 rounded-full bg-white border border-gray-200 text-gray-700 text-base font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Commit screen (step 14) ────────────────────────────────────────────────
  if (step === 14) {
    const radius = 44
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - holdProgress / 100)
    const goalLabel = GOAL_LABELS[answers.primary_goal] || 'reaching your cooking goals'

    return (
      <div className={cn(
        'min-h-screen flex flex-col transition-colors duration-500',
        committed ? 'bg-gray-950' : 'bg-white'
      )}>
        {/* Confetti — renders after commit */}
        {committed && (
          <>
            <style>{`
              @keyframes confetti-fall {
                0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
                100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
              }
            `}</style>
            {CONFETTI_PIECES.map(p => (
              <div
                key={p.id}
                style={{
                  position: 'fixed',
                  left: p.left,
                  top: '0',
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: '2px',
                  animation: `confetti-fall ${p.animDuration} ${p.animDelay} ease-out forwards`,
                  zIndex: 50,
                  pointerEvents: 'none',
                }}
              />
            ))}
          </>
        )}

        {/* Back button (white/gray depending on bg) */}
        {!committed && (
          <div className="flex items-center px-4 pt-12 pb-4">
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}

        {committed ? (
          /* ── Committed state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
            <div className="text-6xl">🤝</div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Committed!</h1>
              <p className="text-gray-400 text-base">This is the first step toward my goal.</p>
            </div>
          </div>
        ) : (
          /* ── Holding state ── */
          <div className="flex-1 flex flex-col px-4">
            <div className="pt-4 mb-auto">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-6">
                Commit to your goal
              </h1>
              <div className="bg-gray-50 rounded-2xl p-5 mb-8">
                <p className="text-gray-500 text-base leading-relaxed">
                  I am committed to my goal of{' '}
                  <span className="font-bold text-gray-900">{goalLabel}</span>.
                  {' '}I will cook with intention and hold myself accountable.
                </p>
              </div>
            </div>

            {/* Tap-and-hold button */}
            <div className="flex flex-col items-center gap-4 pb-16">
              <div
                className="relative select-none touch-none"
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <svg width="120" height="120" viewBox="0 0 120 120" className="block">
                  {/* Track */}
                  <circle
                    cx="60" cy="60" r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  {/* Progress */}
                  <circle
                    cx="60" cy="60" r={radius}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 60 60)"
                  />
                  {/* Center icon */}
                  <foreignObject x="35" y="35" width="50" height="50">
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="w-8 h-8 text-orange-500" />
                    </div>
                  </foreignObject>
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium text-center">
                Tap and hold to make your commitment
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Generating plan screen (step 15) ───────────────────────────────────────
  if (step === 15) {
    return <DarkLoadingScreen message="Building your plan…" />
  }

  // ─── Create account screen (step 16) ────────────────────────────────────────
  if (step === 16) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-500 rounded-2xl p-4">
                <ChefHat className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Almost ready!</h1>
            <p className="text-gray-500 mt-3">
              Create your free account to save your personalised plan.
            </p>
          </div>
          <button
            onClick={handleCreateAccount}
            className="w-full h-14 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center gap-3 text-gray-700 font-semibold text-base hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <p className="text-center text-xs text-gray-400 mt-4">
            Your answers are saved. You won&apos;t lose your progress.
          </p>
        </div>
      </div>
    )
  }

  // ─── Finishing screen (step 17 — post-auth flush) ───────────────────────────
  if (step === 17) {
    return <DarkLoadingScreen message="Setting up your kitchen…" />
  }

  // ─── Shell-wrapped steps (0–13) ─────────────────────────────────────────────
  const showBack = step > 0
  const stepContent = renderStepContent(step, answers, set, toggleArray, goNext, handleNotificationRequest)

  return (
    <OnboardingShell
      step={step}
      total={TOTAL_SHELL_STEPS}
      onBack={showBack ? goBack : undefined}
      onContinue={goNext}
      canContinue={canContinue()}
      hideCta={step === 11}  // notification step uses inline CTAs
      onSignIn={step === 0 ? handleSignIn : undefined}
    >
      {stepContent}
    </OnboardingShell>
  )
}

// ─── Step content renderer ────────────────────────────────────────────────────

function renderStepContent(
  step: number,
  answers: Answers,
  set: <K extends keyof Answers>(key: K, value: Answers[K]) => void,
  toggleArray: (key: 'allergies' | 'favorite_cuisines', value: string) => void,
  goNext: () => void,
  handleNotificationRequest: () => void,
) {
  switch (step) {

    // ── Step 0: Household ───────────────────────────────────────────────────
    case 0:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            Who are you cooking for?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            This helps us personalize your recipe suggestions.
          </p>
          <div className="flex flex-col gap-3">
            {HOUSEHOLD_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                selected={answers.household_size === o.value}
                onClick={() => set('household_size', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 1: Cook frequency ──────────────────────────────────────────────
    case 1:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            How often do you cook per week?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            This will be used to calibrate your custom plan.
          </p>
          <div className="flex flex-col gap-3">
            {FREQUENCY_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                selected={answers.cook_frequency === o.value}
                onClick={() => set('cook_frequency', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 2: Referral source ─────────────────────────────────────────────
    case 2:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-8">
            Where did you hear about us?
          </h1>
          <div className="flex flex-col gap-3">
            {REFERRAL_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                selected={answers.referral_source === o.value}
                onClick={() => set('referral_source', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 3: Value-prop graph ────────────────────────────────────────────
    case 3:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-8">
            Designed to help you cook more
          </h1>
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Your meals over time</p>
            {/* SVG graph */}
            <svg viewBox="0 0 280 120" className="w-full mb-4" aria-hidden="true">
              {/* Grid lines */}
              {[30, 60, 90].map(y => (
                <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
              ))}
              {/* Home-cooked line (going up — orange) */}
              <path
                d="M 10,100 C 60,90 100,70 140,55 S 220,25 270,10"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Takeout line (going down — gray) */}
              <path
                d="M 10,20 C 60,28 100,45 140,60 S 220,85 270,100"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="6,3"
              />
              {/* Dots */}
              <circle cx="10" cy="100" r="4" fill="#f97316" />
              <circle cx="270" cy="10" r="4" fill="#f97316" />
              <circle cx="10" cy="20" r="4" fill="#9ca3af" />
              <circle cx="270" cy="100" r="4" fill="#9ca3af" />
            </svg>
            {/* Legend */}
            <div className="flex gap-4 text-xs text-gray-500 mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full bg-orange-500" />
                Home cooked
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full bg-gray-400" style={{ backgroundImage: 'repeating-linear-gradient(to right, #9ca3af 0 4px, transparent 4px 7px)' }} />
                Takeout
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-3 border-t border-gray-200 pt-3">
              <span>Month 1</span>
              <span>Month 6</span>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              80% of users cook at home more often after just 1 month
            </p>
          </div>
        </div>
      )

    // ── Step 4: Goal ────────────────────────────────────────────────────────
    case 4:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            What&apos;s your goal?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            This helps us generate a plan for your recipe ideas.
          </p>
          <div className="flex flex-col gap-3">
            {GOAL_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                selected={answers.primary_goal === o.value}
                onClick={() => set('primary_goal', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 5: Diet ────────────────────────────────────────────────────────
    case 5:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            Do you follow a specific diet?
          </h1>
          <div className="flex flex-col gap-3">
            {DIET_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                selected={answers.diet === o.value}
                onClick={() => set('diet', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 6: Allergies / avoidances ─────────────────────────────────────
    case 6:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            Anything you avoid?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            We&apos;ll filter these out of your recommendations.
          </p>
          <OptionGrid
            options={ALLERGY_OPTIONS}
            selected={answers.allergies}
            onToggle={v => toggleArray('allergies', v)}
          />
        </div>
      )

    // ── Step 7: Cuisines ────────────────────────────────────────────────────
    case 7:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            Which cuisines do you love?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            Pick as many as you like.
          </p>
          <OptionGrid
            options={CUISINE_OPTIONS}
            selected={answers.favorite_cuisines}
            onToggle={v => toggleArray('favorite_cuisines', v)}
          />
        </div>
      )

    // ── Step 8: Skill level ─────────────────────────────────────────────────
    case 8:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            How confident are you in the kitchen?
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            We&apos;ll match recipe difficulty to your level.
          </p>
          <div className="flex flex-col gap-3">
            {SKILL_OPTIONS.map(o => (
              <OptionCard
                key={o.value}
                icon={o.icon}
                label={o.label}
                description={o.description}
                selected={answers.skill_level === o.value}
                onClick={() => set('skill_level', o.value)}
              />
            ))}
          </div>
        </div>
      )

    // ── Step 9: Potential graph ─────────────────────────────────────────────
    case 9:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-8">
            You have great potential to crush your goal
          </h1>
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Your cooking growth</p>
            <svg viewBox="0 0 280 120" className="w-full mb-3" aria-hidden="true">
              {/* Grid */}
              {[40, 80].map(y => (
                <line key={y} x1="30" y1={y} x2="270" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
              ))}
              {/* Dashed future zone */}
              <rect x="160" y="0" width="110" height="120" fill="#fff7ed" opacity="0.6" />
              {/* Growth line */}
              <path
                d="M 30,105 L 110,95 C 140,92 160,75 210,45 S 260,15 270,8"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Area fill */}
              <path
                d="M 30,105 L 110,95 C 140,92 160,75 210,45 S 260,15 270,8 L 270,120 L 30,120 Z"
                fill="#f97316"
                opacity="0.08"
              />
              {/* Milestone dots */}
              <circle cx="30" cy="105" r="5" fill="white" stroke="#374151" strokeWidth="2" />
              <circle cx="110" cy="95" r="5" fill="white" stroke="#374151" strokeWidth="2" />
              <circle cx="210" cy="45" r="5" fill="white" stroke="#f97316" strokeWidth="2" />
              {/* Trophy at end */}
              <text x="258" y="12" fontSize="14" textAnchor="middle">🏆</text>
            </svg>
            <div className="flex justify-between text-xs text-gray-400 border-t border-gray-200 pt-3 mb-3">
              <span>Start</span>
              <span>1 Week</span>
              <span>1 Month</span>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Users who set goals cook 2.5× more than before
            </p>
          </div>
        </div>
      )

    // ── Step 10: Thank you ──────────────────────────────────────────────────
    case 10:
      return (
        <div className="flex flex-col items-center text-center pt-8">
          <div className="w-36 h-36 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-8 shadow-inner">
            <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center shadow-sm">
              <span className="text-5xl">🤝</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Thank you for trusting us!
          </h1>
          <p className="text-gray-400 text-base">
            Now let&apos;s personalize Mise en Place for you...
          </p>
        </div>
      )

    // ── Step 11: Notifications ──────────────────────────────────────────────
    case 11:
      return (
        <div className="flex flex-col pt-8">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3 text-center">
            Reach your goals with meal reminders
          </h1>
          <p className="text-gray-400 text-sm text-center mb-10">
            We&apos;ll nudge you to plan and cook — on your schedule.
          </p>
          {/* Simulated notification prompt */}
          <div className="bg-gray-100 rounded-2xl overflow-hidden mb-8">
            <div className="bg-gray-200 px-5 py-4 text-center">
              <p className="font-semibold text-gray-900 text-sm">
                &ldquo;Mise en Place&rdquo; would like to send you notifications
              </p>
            </div>
            <div className="flex divide-x divide-gray-300">
              <button
                onClick={() => { set('meal_reminders', false); goNext() }}
                className="flex-1 py-3.5 text-center text-gray-500 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Don&apos;t Allow
              </button>
              <button
                onClick={handleNotificationRequest}
                className="flex-1 py-3.5 text-center text-orange-500 font-semibold text-sm hover:bg-orange-50 transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )

    // ── Step 12: Social proof ───────────────────────────────────────────────
    case 12:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-6">
            Join home cooks like you
          </h1>
          {/* Stats row */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">4.9</p>
              <div className="text-yellow-400 text-sm mb-1">★★★★★</div>
              <p className="text-xs text-gray-500">App rating</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">10K+</p>
              <div className="text-lg mb-1">👨‍🍳</div>
              <p className="text-xs text-gray-500">Home cooks</p>
            </div>
          </div>
          {/* Testimonials */}
          <div className="flex flex-col gap-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-yellow-400 text-sm">{'★'.repeat(t.rating)}</div>
                  <p className="text-xs font-semibold text-gray-500">{t.name}</p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )

    // ── Step 13: Home cooked vs. takeout comparison ─────────────────────────
    case 13:
      return (
        <div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
            The real cost of takeout
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Here&apos;s what the numbers actually look like.
          </p>

          {/* Side-by-side header */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
              <div className="text-3xl mb-1">🏠</div>
              <p className="font-bold text-orange-700 text-sm">Home Cooked</p>
            </div>
            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-center">
              <div className="text-3xl mb-1">🥡</div>
              <p className="font-bold text-gray-500 text-sm">Takeout</p>
            </div>
          </div>

          {/* Comparison rows */}
          {[
            {
              label: 'Cost per meal',
              home: { value: '~$4', sub: 'per serving', good: true },
              takeout: { value: '~$18', sub: 'per serving', good: false },
            },
            {
              label: 'Monthly spend (5×/wk)',
              home: { value: '$80', sub: 'per month', good: true },
              takeout: { value: '$360', sub: 'per month', good: false },
            },
            {
              label: 'Sodium',
              home: { value: 'Controlled', sub: 'you set the salt', good: true },
              takeout: { value: '2–3×', sub: 'daily limit, avg.', good: false },
            },
            {
              label: 'Ingredients',
              home: { value: 'You know every one', sub: 'fresh & whole', good: true },
              takeout: { value: 'Unknown additives', sub: 'preservatives, fillers', good: false },
            },
            {
              label: 'Portion size',
              home: { value: 'Your choice', sub: 'right for your goal', good: true },
              takeout: { value: 'Restaurant-sized', sub: 'often 2× what you need', good: false },
            },
          ].map(row => (
            <div key={row.label} className="mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                {row.label}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  'rounded-xl px-3 py-2.5',
                  row.home.good ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                )}>
                  <p className={cn(
                    'font-bold text-sm leading-tight',
                    row.home.good ? 'text-green-700' : 'text-red-600'
                  )}>
                    {row.home.good ? '✓ ' : '✗ '}{row.home.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{row.home.sub}</p>
                </div>
                <div className={cn(
                  'rounded-xl px-3 py-2.5',
                  row.takeout.good ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-100'
                )}>
                  <p className={cn(
                    'font-bold text-sm leading-tight',
                    row.takeout.good ? 'text-green-700' : 'text-red-500'
                  )}>
                    {row.takeout.good ? '✓ ' : '✗ '}{row.takeout.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{row.takeout.sub}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Bottom callout */}
          <div className="mt-5 bg-orange-500 rounded-2xl px-5 py-4 text-center">
            <p className="text-white font-bold text-lg leading-tight">
              Cook 5×/week → save $3,360/year
            </p>
            <p className="text-orange-100 text-sm mt-1">
              That&apos;s a vacation. Or a very good knife set.
            </p>
          </div>
        </div>
      )

    default:
      return null
  }
}
