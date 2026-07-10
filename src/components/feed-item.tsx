import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { BookOpen } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import type { FeedItem } from '@/lib/db/activity'

/** One activity-feed row. Server-safe (no hooks) so Home and /feed both use it. */
export function FeedItemRow({ item }: { item: FeedItem }) {
  const name = item.actor.display_name || item.actor.username
  const when = formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })

  let verb = 'shared'
  let subject = ''
  let href = `/u/${item.actor.username}`
  if (item.type === 'cookbook_created' && item.cookbook) {
    verb = 'created a cookbook'
    subject = item.cookbook.name
    href = `/u/${item.actor.username}/cookbooks/${item.cookbook.id}`
  } else if (item.recipe) {
    verb = item.type === 'recipe_cooked' ? 'cooked' : 'added'
    subject = item.recipe.name
    href = `/recipes/${item.recipe.id}`
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98]"
    >
      <UserAvatar name={name} src={item.actor.avatar_url} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">
          <span className="font-bold">{name}</span>{' '}
          <span className="text-muted-foreground">{verb}</span>{' '}
          {subject && <span className="font-semibold">{subject}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{when}</p>
      </div>
      {item.recipe?.image_url ? (
        <img src={item.recipe.image_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      ) : item.recipe ? (
        <div className="food-placeholder grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl">
          {getCuisineEmoji(item.recipe.cuisine)}
        </div>
      ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-subtle">
          <BookOpen className="h-5 w-5 text-brand" />
        </div>
      )}
    </Link>
  )
}
