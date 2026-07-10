import { getCookbook } from '@/lib/db/cookbooks'
import { getRankedScores } from '@/lib/db/recipes'
import { notFound } from 'next/navigation'
import CookbookDetailView from '@/components/cookbook-detail-view'

export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [cookbook, scores] = await Promise.all([getCookbook(id), getRankedScores()])
  if (!cookbook) notFound()
  return <CookbookDetailView cookbook={cookbook} scores={scores} />
}
