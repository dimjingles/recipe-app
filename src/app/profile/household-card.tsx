'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Copy, QrCode, UserPlus, LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'
import { QRCode } from '@/components/qr-code'
import { PublicProfile } from '@/types/database'

export interface HouseholdData {
  id: string
  name: string
  role: string
  members: PublicProfile[]
}

export default function HouseholdCard({ initialHousehold }: { initialHousehold: HouseholdData | null }) {
  const router = useRouter()
  const [household, setHousehold] = useState<HouseholdData | null>(initialHousehold)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [friends, setFriends] = useState<PublicProfile[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [invitingFriend, setInvitingFriend] = useState(false)

  const memberIds = useMemo(() => new Set((household?.members ?? []).map(member => member.id)), [household?.members])
  const availableFriends = useMemo(
    () => friends.filter(friend => friend.id && !memberIds.has(friend.id)),
    [friends, memberIds]
  )

  const inviteLink = typeof window !== 'undefined' && inviteToken
    ? `${window.location.origin}/household/join/${inviteToken}`
    : ''

  useEffect(() => {
    if (!household) {
      setFriends([])
      setSelectedFriendId('')
      return
    }

    let cancelled = false
    const loadFriends = async () => {
      setLoadingFriends(true)
      try {
        const res = await fetch('/api/friends')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed')
        if (!cancelled) setFriends(data.friends ?? [])
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || 'Could not load friends')
      } finally {
        if (!cancelled) setLoadingFriends(false)
      }
    }

    loadFriends()
    return () => { cancelled = true }
  }, [household?.id])

  const create = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Our Kitchen' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Household created')
      router.refresh()
      // Reflect immediately (full member list arrives on refresh).
      setHousehold({ id: data.id, name: name.trim() || 'Our Kitchen', role: 'admin', members: [] })
    } catch (e: any) {
      toast.error(e.message || 'Could not create household')
    } finally {
      setBusy(false)
    }
  }

  const makeInvite = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/household/invite', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setInviteToken(data.token)
    } catch (e: any) {
      toast.error(e.message || 'Could not create invite')
    } finally {
      setBusy(false)
    }
  }

  const inviteFriend = async () => {
    if (!selectedFriendId) return
    setInvitingFriend(true)
    try {
      const res = await fetch('/api/household/invite-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: selectedFriendId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      const added = data.member as PublicProfile | null
      if (added) {
        setHousehold(current => current ? { ...current, members: [...current.members, added] } : current)
      }
      setSelectedFriendId('')
      toast.success('Friend added to household')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not add friend')
    } finally {
      setInvitingFriend(false)
    }
  }

  const leave = async () => {
    if (!household) return
    if (!confirm('Leave this household? Shared recipes stay with the household.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/household', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: household.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success('Left household')
      setHousehold(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not leave')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Home className="h-4 w-4 text-brand" />
        <h2 className="font-heading text-lg font-bold text-foreground">Household</h2>
      </div>

      {!household ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Share one recipe library with a partner. You each keep your own ranking for every recipe.
          </p>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Household name (e.g. Our Kitchen)"
              className="flex-1 bg-card"
            />
            <button
              onClick={create}
              disabled={busy}
              className="shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground disabled:opacity-50"
            >
              {busy ? '…' : 'Create'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-foreground">{household.name}</p>
          <p className="mb-3 text-xs text-muted-foreground">Rankings stay personal — you each rank recipes your own way.</p>

          {household.members.length > 0 && (
            <div className="mb-4 space-y-2">
              {household.members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <UserAvatar name={m.display_name || m.username} src={m.avatar_url} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{m.display_name || m.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-3 rounded-2xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Add an existing friend</p>
            {loadingFriends ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading friends…
              </div>
            ) : availableFriends.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedFriendId}
                  onChange={e => setSelectedFriendId(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a friend</option>
                  {availableFriends.map(friend => (
                    <option key={friend.id} value={friend.id}>
                      {friend.display_name || friend.username || 'Friend'}{friend.username ? ` (@${friend.username})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={inviteFriend}
                  disabled={!selectedFriendId || invitingFriend}
                  className="shrink-0 rounded-xl bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
                >
                  {invitingFriend ? '…' : 'Add'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No friends available. Use an invite link for anyone not already in your friends list.</p>
            )}
          </div>

          {inviteToken ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Invite link</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-xs">{inviteLink}</code>
                <button onClick={() => { navigator.clipboard?.writeText(inviteLink); toast.success('Copied') }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background" aria-label="Copy invite">
                  <Copy className="h-4 w-4" />
                </button>
                <button onClick={() => setShowQr(s => !s)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${showQr ? 'bg-brand text-brand-foreground' : 'bg-muted text-foreground'}`} aria-label="QR">
                  <QrCode className="h-4 w-4" />
                </button>
              </div>
              {showQr && inviteLink && (
                <div className="mt-3 flex justify-center">
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border"><QRCode value={inviteLink} size={160} /></div>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Link expires in 7 days.</p>
            </div>
          ) : (
            <button
              onClick={makeInvite}
              disabled={busy}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite a partner
            </button>
          )}

          <button
            onClick={leave}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 pt-1 text-sm font-medium text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Leave household
          </button>
        </>
      )}
    </div>
  )
}
