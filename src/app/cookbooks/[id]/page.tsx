import { getCookbook } from '@/lib/db/cookbooks'
import { getMyHouseholdId } from '@/lib/db/households'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CookbookDetailView from '@/components/cookbook-detail-view'

export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [cookbook, householdId] = await Promise.all([getCookbook(id), getMyHouseholdId()])
  if (!cookbook) notFound()

  // Only the creator manages a shared cookbook; members view it read-only.
  const canManage = !!user && cookbook.user_id === user.id
  return <CookbookDetailView cookbook={cookbook} canManage={canManage} hasHousehold={!!householdId} />
}
