'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FeedItemRow } from '@/components/feed-item'
import type { FeedItem } from '@/lib/db/activity'

export default function FeedList({
  items,
  hasMore,
  loading,
  onLoadMore,
}: {
  items: FeedItem[]
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="p-1 -ml-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Friends activity</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <p className="font-heading text-lg font-bold text-foreground">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When your friends cook and create, it&apos;ll show up here.{' '}
            <Link href="/friends" className="font-bold text-brand">Find friends</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => <FeedItemRow key={item.id} item={item} />)}
        </div>
      )}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-muted py-3 text-sm font-bold text-foreground transition-colors hover:bg-border disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
