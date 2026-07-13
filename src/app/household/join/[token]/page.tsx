import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getHouseholdInviteInfo, getMyHouseholdId } from '@/lib/db/households'
import JoinHousehold from './join-household'

export default async function JoinHouseholdPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await getUser()
  if (!user) redirect(`/login?next=/household/join/${token}`)

  const [info, myHouseholdId] = await Promise.all([
    getHouseholdInviteInfo(token),
    getMyHouseholdId(),
  ])

  return <JoinHousehold token={token} info={info} alreadyInHousehold={!!myHouseholdId} />
}
