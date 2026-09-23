import CookbookClient from './cookbook-client'

// Thin shell — the cookbook renders from the client query cache.
export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CookbookClient id={id} />
}
