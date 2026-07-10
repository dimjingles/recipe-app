'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Check, Clock, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/user-avatar'
import { RecipeCard } from '@/components/recipe-card'
import { PublicProfile, Recipe, CookbookWithCount } from '@/types/database'
import type { FriendshipStatus } from '@/lib/db/social'

interface Props {
  profile: PublicProfile
  isSelf: boolean
  initialStatus: FriendshipStatus
  recipes: Recipe[]
  cookbooks: CookbookWithCount[]
}

export default function FriendProfileView({ profile, isSelf, initialStatus, recipes, cookbooks }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus)
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<Response>, next: FriendshipStatus, successMsg: string) => {
    setBusy(true)
    const prev = status
    setStatus(next)
    try {
      const res = await fn()
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success(successMsg)
    } catch (e: any) {
      setStatus(prev)
      toast.error(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const addFriend = () => act(
    () => fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: profile.id }) }),
    'outgoing', `Request sent to @${profile.username}`,
  )
  const accept = () => act(
    () => fetch('/api/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_id: profile.id, accept: true }) }),
    'friends', `You're now friends with @${profile.username}`,
  )
  const removeFriend = () => act(
    () => fetch('/api/friends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_id: profile.id }) }),
    'none', `Unfriended @${profile.username}`,
  )

  const FriendButton = () => {
    if (isSelf) return <Link href="/profile" className="rounded-full bg-muted px-5 py-2.5 text-sm font-bold text-foreground">Edit profile</Link>
    if (status === 'friends') return (
      <button onClick={removeFriend} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-sage-subtle px-5 py-2.5 text-sm font-bold text-sage disabled:opacity-60">
        <Check className="h-4 w-4" /> Friends
      </button>
    )
    if (status === 'outgoing') return <span className="flex items-center gap-1.5 rounded-full bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground"><Clock className="h-4 w-4" /> Requested</span>
    if (status === 'incoming') return (
      <button onClick={accept} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground disabled:opacity-60">
        <Check className="h-4 w-4" /> Accept request
      </button>
    )
    if (status === 'blocked') return <span className="rounded-full bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground">Unavailable</span>
    return (
      <button onClick={addFriend} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground disabled:opacity-60">
        <UserPlus className="h-4 w-4" /> Add friend
      </button>
    )
  }

  const canSeeContent = isSelf || status === 'friends'

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-24">
      <Link href="/friends" className="mb-6 inline-flex items-center gap-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]">
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <UserAvatar name={profile.display_name || profile.username} src={profile.avatar_url} size={96} />
        <h1 className="mt-3 font-heading text-2xl font-bold text-foreground">{profile.display_name || profile.username}</h1>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <span><span className="font-bold text-foreground">{recipes.length}</span> <span className="text-muted-foreground">recipes</span></span>
          <span><span className="font-bold text-foreground">{cookbooks.length}</span> <span className="text-muted-foreground">cookbooks</span></span>
        </div>
        <div className="mt-4"><FriendButton /></div>
      </div>

      {!canSeeContent ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <p className="font-heading text-lg font-bold text-foreground">Add {profile.display_name || `@${profile.username}`} to see their recipes</p>
          <p className="mt-1 text-sm text-muted-foreground">Friends can browse each other&apos;s visible cookbooks and recipes.</p>
        </div>
      ) : (
        <>
          {/* Cookbooks */}
          {cookbooks.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 font-heading text-lg font-bold text-foreground">Cookbooks</h2>
              <div className="grid grid-cols-2 gap-3">
                {cookbooks.map(cb => (
                  <Link
                    key={cb.id}
                    href={`/u/${profile.username}/cookbooks/${cb.id}`}
                    className="rounded-2xl border border-border bg-card px-4 py-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98]"
                  >
                    <BookOpen className="mb-2 h-5 w-5 text-brand" />
                    <p className="truncate text-sm font-bold text-foreground">{cb.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cb.cookbook_recipes.length} recipes</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recipes */}
          <section className="mt-10">
            <h2 className="mb-3 font-heading text-lg font-bold text-foreground">Recipes</h2>
            {recipes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No visible recipes yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recipes.map(r => (
                  <RecipeCard key={r.id} recipe={r} variant="grid" onClick={() => router.push(`/recipes/${r.id}`)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
