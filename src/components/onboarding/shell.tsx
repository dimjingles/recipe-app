'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingShellProps {
  step: number          // 0-based current step
  total: number         // total steps that show the shell
  onBack?: () => void   // undefined = no back button
  onContinue: () => void
  canContinue: boolean
  hideCta?: boolean     // for steps with custom bottom UIs
  onSignIn?: () => void // show "Sign in" link in header when provided
  children: React.ReactNode
}

export default function OnboardingShell({
  step,
  total,
  onBack,
  onContinue,
  canContinue,
  hideCta,
  onSignIn,
  children,
}: OnboardingShellProps) {
  const progress = Math.round(((step + 1) / total) * 100)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar + back + sign-in */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 flex-shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:bg-gray-200 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        ) : (
          <div className="w-9 h-9 flex-shrink-0" />
        )}
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {onSignIn ? (
          <button
            onClick={onSignIn}
            className="flex-shrink-0 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
          >
            Sign in
          </button>
        ) : (
          <div className="w-12 flex-shrink-0" />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 pt-2 pb-4 overflow-y-auto">
        {children}
      </div>

      {/* Pinned CTA */}
      {!hideCta && (
        <div className="flex-shrink-0 px-4 pb-10 pt-3 bg-white">
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={cn(
              'w-full h-14 rounded-full text-base font-semibold transition-all duration-150',
              canContinue
                ? 'bg-orange-500 text-white active:scale-[0.98] hover:bg-orange-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
