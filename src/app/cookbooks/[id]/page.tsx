import { getCookbook } from '@/lib/db/cookbooks'
import { getRankedScores } from '@/lib/db/recipes'
import { getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CookbookDetailView from '@/components/cookbook-detail-view'

export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()

  const [cookbook, scores] = await Promise.all([
    getCookbook(id),
    getRankedScores(),
  ])
  if (!cookbook) notFound()

  const canManage = !!user && cookbook.user_id === user.id
  return <CookbookDetailView cookbook={cookbook} canManage={canManage} scores={scores} />
}
