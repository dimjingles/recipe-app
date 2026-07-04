import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const profile = await getProfile()
    if (profile?.onboarding_completed) {
      redirect('/')
    }
    // Authenticated but no completed profile → skip welcome, go to questions
    return <OnboardingWizard initialStep={0} />
  }

  // Not authenticated → show welcome screen with sign up / sign in options
  return <OnboardingWizard initialStep={-1} />
}
