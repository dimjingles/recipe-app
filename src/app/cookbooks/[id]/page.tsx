import { getCookbook } from '@/lib/db/cookbooks'
import { notFound } from 'next/navigation'
import CookbookDetailView from '@/components/cookbook-detail-view'

export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookbook = await getCookbook(id)
  if (!cookbook) notFound()
  return <CookbookDetailView cookbook={cookbook} />
}
