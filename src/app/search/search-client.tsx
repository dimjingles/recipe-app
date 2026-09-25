'use client'

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronRight, Clock, Link2, PenLine, Plus, Search, Sparkles, Users, X } from 'lucide-react'
import {
  queries,
  useForYou,
  useFriendRecipeSearch,
  useFriends,
  useRecipes,
  useRecordRecent,
  useRemoveRecent,
  useSearchRecents,
  type RecentInput,
} from '@/lib/queries/hooks'
import type { FriendRecipe, RecentSearch, RecipeOwner } from '@/lib/db/search'
import { useAuthRedirect } from '@/components/cached-page'
import { LazyAddRecipeSheet, loadAddRecipeSheet } from '@/components/add-recipe-launcher'
import { InstagramIcon, TikTokIcon, YouTubeIcon } from '@/components/brand-icons'
import { Shimmer } from '@/components/ui/shimmer'
import { UserAvatar } from '@/components/user-avatar'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { isExactNameMatch, searchRecipes } from '@/lib/recipe-search'
import { cn } from '@/lib/utils'

/** Own results shown before "Show all". */
const OWN_PREVIEW = 5
const RECENTS_SHOWN = 8
/** Friends' recipes are searched server-side once the query settles. */
const FRIEND_SEARCH_DEBOUNCE_MS = 250
const MIN_QUERY = 2

type SheetLaunch = { key: number; open: boolean; view?: 'platforms' | 'photo'; name?: string }

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function SearchClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  // ?q= seeds the input once, before paint; the input owns the query after that.
  // Read from location rather than useSearchParams: that needs a Suspense
  // boundary, which hydrates after the persisted query cache restores and so
  // mismatches the server HTML.
  useLayoutEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setQuery(q)
  }, [])
  const trimmed = query.trim()
  const deferredQuery = useDeferredValue(trimmed)
  const friendQuery = useDebouncedValue(trimmed, FRIEND_SEARCH_DEBOUNCE_MS)
  const inputRef = useRef<HTMLInputElement>(null)

  const recipes = useRecipes()
  const friends = useFriends()
  const recents = useSearchRecents()
  const forYou = useForYou()
  const friendSearch = useFriendRecipeSearch(friendQuery.length >= MIN_QUERY ? friendQuery : '')
  const recordRecent = useRecordRecent()
  const removeRecent = useRemoveRecent()
  useAuthRedirect(recipes.error, friends.error, recents.error, forYou.error)

  // The add-recipe sheet, remounted per launch so it opens on the chosen step.
  const [sheet, setSheet] = useState<SheetLaunch | null>(null)
  const launchSheet = (launch: Omit<SheetLaunch, 'key' | 'open'>) =>
    setSheet({ ...launch, key: Date.now(), open: true })

  // Keep the query in the URL so Back from a recipe returns to the same results.
  // (Pages remount on navigation, so component state alone would be lost.)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (friendQuery) url.searchParams.set('q', friendQuery)
    else url.searchParams.delete('q')
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
  }, [friendQuery])

  const ownResults = useMemo(
    () => (deferredQuery ? searchRecipes(recipes.data ?? [], deferredQuery) : []),
    [recipes.data, deferredQuery],
  )
  const exactMatch = ownResults.find(r => isExactNameMatch(r, trimmed))
  const [showAllOwn, setShowAllOwn] = useState(false)
  useEffect(() => { setShowAllOwn(false) }, [deferredQuery])

  const prefetch = (id: string) => void queryClient.prefetchQuery(queries.recipe(id))
  const open = (recent: RecentInput) => {
    recordRecent.mutate(recent)
    router.push(`/recipes/${recent.id}`)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Enter opens an exact match; it never starts AI generation.
    if (exactMatch) {
      open({ id: exactMatch.id, name: exactMatch.name, cuisine: exactMatch.cuisine, image_url: heroOf(exactMatch), mine: true, owner: null })
    } else {
      inputRef.current?.blur()
    }
  }

  const createRow = trimmed.length >= MIN_QUERY && !exactMatch && (
    <button
      onPointerDown={() => void loadAddRecipeSheet()}
      onClick={() => launchSheet({ name: trimmed })}
      className="flex w-full items-center gap-3 rounded-2xl border border-sage/25 bg-sage-subtle p-3 text-left transition-all hover:border-sage/40 active:scale-[0.98]"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sage text-sage-foreground shadow-card">
        <Plus className="h-6 w-6 stroke-[2.6px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-base font-bold text-foreground">
          Create “{trimmed}”
        </span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-sage" /> Generate the recipe with AI
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )

  const friendResults = friendQuery.length >= MIN_QUERY ? friendSearch.data ?? [] : []
  const friendsLoading = trimmed.length >= MIN_QUERY && (friendQuery !== trimmed || friendSearch.isPending)
  const shownOwn = showAllOwn ? ownResults : ownResults.slice(0, OWN_PREVIEW)

  return (
    <div className="mx-auto max-w-2xl px-5 pt-8 pb-4 md:px-8">
      <h1 className="mb-5 font-heading text-3xl font-bold tracking-tight text-foreground">Search</h1>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => void loadAddRecipeSheet()}
          placeholder="What do you want to cook?"
          aria-label="Search your recipes and your friends'"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-border bg-card pl-12 pr-11 text-base font-medium text-foreground shadow-card outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {trimmed ? (
        // ── Typing: your recipes, create, friends' recipes ──
        <div className="space-y-7">
          {ownResults.length === 0 && createRow}

          {ownResults.length > 0 && (
            <section>
              <SectionTitle count={ownResults.length}>Your recipes</SectionTitle>
              <ul className="space-y-1">
                {shownOwn.map(r => (
                  <li key={r.id}>
                    <ResultRow
                      name={r.name}
                      image={heroOf(r)}
                      cuisine={r.cuisine}
                      meta={metaLine(r.cuisine, r.cook_time_minutes)}
                      onOpen={() => open({ id: r.id, name: r.name, cuisine: r.cuisine, image_url: heroOf(r), mine: true, owner: null })}
                      onIntent={() => prefetch(r.id)}
                    />
                  </li>
                ))}
              </ul>
              {ownResults.length > OWN_PREVIEW && !showAllOwn && (
                <button
                  onClick={() => setShowAllOwn(true)}
                  className="mt-1 px-2 text-sm font-bold text-brand"
                >
                  Show all {ownResults.length}
                </button>
              )}
            </section>
          )}

          {ownResults.length > 0 && createRow}

          {trimmed.length >= MIN_QUERY && (
            <section>
              <SectionTitle icon={<Users className="h-4 w-4" />}>From friends</SectionTitle>
              {friendsLoading && friendResults.length === 0 ? (
                <RowSkeletons count={2} />
              ) : friendResults.length > 0 ? (
                <ul className="space-y-1">
                  {friendResults.map(r => (
                    <li key={r.id}>
                      <ResultRow
                        name={r.name}
                        image={r.image_url}
                        cuisine={r.cuisine}
                        meta={metaLine(r.cuisine, r.cook_time_minutes)}
                        owner={r.owner}
                        onOpen={() => open(friendRecent(r))}
                        onIntent={() => prefetch(r.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 text-sm text-muted-foreground">
                  {friends.data && friends.data.friends.length === 0
                    ? 'Add friends to search their recipes too.'
                    : `None of your friends have shared a “${trimmed}” recipe yet.`}
                </p>
              )}
            </section>
          )}
        </div>
      ) : (
        // ── Idle: ways to add, recents, recommendations ──
        <div className="space-y-8">
          <section>
            <SectionTitle>Add a recipe</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <AddTile
                label="Social media"
                detail="TikTok, Reels, YouTube"
                className="bg-brand-subtle"
                art={
                  <span className="flex -space-x-2">
                    <InstagramIcon className="h-6 w-6 drop-shadow-sm" />
                    <TikTokIcon className="h-6 w-6 drop-shadow-sm" />
                    <YouTubeIcon className="h-6 w-6 drop-shadow-sm" />
                  </span>
                }
                onPointerDown={() => void loadAddRecipeSheet()}
                onClick={() => launchSheet({ view: 'platforms' })}
              />
              <AddTile
                label="From a photo"
                detail="Snap or upload a dish"
                className="bg-sage-subtle"
                art={<TileIcon className="text-sage"><Camera className="h-5 w-5" /></TileIcon>}
                onPointerDown={() => void loadAddRecipeSheet()}
                onClick={() => launchSheet({ view: 'photo' })}
              />
              <AddTile
                label="From the web"
                detail="Paste any recipe link"
                className="bg-info-subtle"
                art={<TileIcon className="text-info"><Link2 className="h-5 w-5" /></TileIcon>}
                href="/import"
              />
              <AddTile
                label="Write from scratch"
                detail="Type in your own"
                className="bg-lavender-subtle"
                art={<TileIcon className="text-foreground/70"><PenLine className="h-5 w-5" /></TileIcon>}
                href="/recipes/new"
              />
            </div>
          </section>

          {recents.isPending ? (
            <section>
              <SectionTitle>Recents</SectionTitle>
              <RowSkeletons count={3} />
            </section>
          ) : (recents.data?.length ?? 0) > 0 ? (
            <section>
              <SectionTitle>Recents</SectionTitle>
              <ul className="divide-y divide-border">
                {recents.data!.slice(0, RECENTS_SHOWN).map(r => (
                  <RecentRow
                    key={r.id}
                    recent={r}
                    onOpen={() => open(r)}
                    onIntent={() => prefetch(r.id)}
                    onRemove={() => removeRecent.mutate(r.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionTitle>Recipes we think you&apos;ll like</SectionTitle>
            {forYou.isPending ? (
              <div className="-mx-5 flex gap-3 overflow-hidden px-5 md:-mx-8 md:px-8">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-[150px] shrink-0">
                    <Shimmer className="aspect-[3/4] w-full rounded-2xl" />
                    <Shimmer className="mt-2 h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : (forYou.data?.length ?? 0) > 0 ? (
              <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide md:-mx-8 md:scroll-px-8 md:px-8">
                {forYou.data!.map(r => (
                  <ForYouCard
                    key={r.id}
                    recipe={r}
                    onOpen={() => open(friendRecent(r))}
                    onIntent={() => prefetch(r.id)}
                  />
                ))}
              </div>
            ) : (
              <Link
                href="/friends"
                className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 transition-all active:scale-[0.98]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-bold text-foreground">
                    {friends.data && friends.data.friends.length > 0
                      ? 'Nothing new from friends yet'
                      : 'Add friends to see what they cook'}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    We&apos;ll pick recipes from friends that match the ones you like.
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </section>
        </div>
      )}

      {sheet && (
        <LazyAddRecipeSheet
          key={sheet.key}
          open={sheet.open}
          initialView={sheet.view}
          initialName={sheet.name}
          onClose={() => setSheet(s => (s ? { ...s, open: false } : s))}
          onCreated={r => recordRecent.mutate({ ...r, mine: true, owner: null })}
        />
      )}
    </div>
  )
}

function heroOf(r: { image_url?: string | null; gallery_images?: string[] | null }): string | null {
  return r.image_url ?? r.gallery_images?.[0] ?? null
}

/** Cuisines are stored as typed ("korean", "Korean"); show them capitalized. */
function capitalize(s: string | null | undefined): string | null {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null
}

function metaLine(cuisine: string | null | undefined, minutes: number | null | undefined): string {
  return [capitalize(cuisine), minutes ? `${minutes} min` : null].filter(Boolean).join(' · ')
}

function friendRecent(r: FriendRecipe): RecentInput {
  return { id: r.id, name: r.name, cuisine: r.cuisine, image_url: r.image_url, mine: false, owner: r.owner }
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function SectionTitle({ children, count, icon }: { children: ReactNode; count?: number; icon?: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 font-heading text-xl font-bold tracking-tight text-foreground">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      {children}
      {count != null && <span className="text-sm font-semibold text-muted-foreground">{count}</span>}
    </h2>
  )
}

function RowSkeletons({ count }: { count: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Shimmer className="h-14 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function RecipeThumb({ src, cuisine, className }: { src: string | null; cuisine: string | null | undefined; className?: string }) {
  // Scraped image URLs can 404 or hotlink-block: fall back to the placeholder.
  const [broken, setBroken] = useState(false)
  return (
    <span className={cn('relative block shrink-0 overflow-hidden bg-muted', className)}>
      {src && !broken ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span className="food-placeholder grid h-full w-full place-items-center text-xl">{getCuisineEmoji(cuisine)}</span>
      )}
    </span>
  )
}

function ResultRow({
  name,
  image,
  cuisine,
  meta,
  owner,
  onOpen,
  onIntent,
}: {
  name: string
  image: string | null
  cuisine: string | null
  meta: string
  owner?: RecipeOwner | null
  onOpen: () => void
  onIntent: () => void
}) {
  return (
    <button
      onClick={onOpen}
      onPointerDown={onIntent}
      className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-card active:scale-[0.99]"
    >
      <RecipeThumb src={image} cuisine={cuisine} className="h-14 w-14 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-foreground">{name}</span>
        {meta && <span className="block truncate text-sm text-muted-foreground">{meta}</span>}
        {owner && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <UserAvatar name={owner.display_name || owner.username} src={owner.avatar_url} size={16} />
            <span className="truncate">@{owner.username}</span>
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  )
}

function RecentRow({
  recent,
  onOpen,
  onIntent,
  onRemove,
}: {
  recent: RecentSearch
  onOpen: () => void
  onIntent: () => void
  onRemove: () => void
}) {
  const sub = [
    capitalize(recent.cuisine),
    recent.mine ? 'Your recipe' : recent.owner ? `@${recent.owner.username}` : 'A friend’s recipe',
  ].filter(Boolean).join(' · ')
  return (
    <li className="flex items-center gap-3">
      <button onClick={onOpen} onPointerDown={onIntent} className="flex min-w-0 flex-1 items-center gap-4 py-3 text-left">
        <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">{recent.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{sub}</span>
        </span>
      </button>
      <button
        onClick={onRemove}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${recent.name} from recents`}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}

function ForYouCard({ recipe, onOpen, onIntent }: { recipe: FriendRecipe; onOpen: () => void; onIntent: () => void }) {
  return (
    <button onClick={onOpen} onPointerDown={onIntent} className="w-[150px] shrink-0 snap-start text-left transition-transform active:scale-[0.97]">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-card">
        <RecipeThumb src={recipe.image_url} cuisine={recipe.cuisine} className="h-full w-full" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-12">
          <span className="line-clamp-2 text-sm font-bold leading-snug text-white">{recipe.name}</span>
          {recipe.cuisine && (
            <span className="mt-0.5 block truncate text-xs font-medium capitalize text-white/80">{recipe.cuisine}</span>
          )}
        </span>
      </span>
      {recipe.owner && (
        <span className="mt-2 flex items-center gap-1.5">
          <UserAvatar name={recipe.owner.display_name || recipe.owner.username} src={recipe.owner.avatar_url} size={18} />
          <span className="truncate text-xs font-semibold text-muted-foreground">@{recipe.owner.username}</span>
        </span>
      )}
    </button>
  )
}

function TileIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('grid h-10 w-10 place-items-center rounded-full bg-card/80 shadow-sm', className)}>
      {children}
    </span>
  )
}

function AddTile({
  label,
  detail,
  art,
  className,
  href,
  onClick,
  onPointerDown,
}: {
  label: string
  detail: string
  art: ReactNode
  className: string
  href?: string
  onClick?: () => void
  onPointerDown?: () => void
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block font-heading text-[15px] font-bold leading-tight text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="self-end">{art}</span>
    </>
  )
  const tileClass = cn(
    'flex h-[104px] flex-col justify-between rounded-2xl p-3.5 text-left ring-1 ring-black/[0.03] transition-all active:scale-[0.97]',
    className,
  )
  return href ? (
    <Link href={href} className={tileClass}>{body}</Link>
  ) : (
    <button onClick={onClick} onPointerDown={onPointerDown} className={tileClass}>{body}</button>
  )
}
