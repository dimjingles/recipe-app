'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, UserPlus, Check, X, Clock, Copy, QrCode, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'
import { QRCode } from '@/components/qr-code'
import { PublicProfile } from '@/types/database'

type Tab = 'friends' | 'requests' | 'find'

interface Props {
  myUsername: string | null
  initialFriends: PublicProfile[]
  initialIncoming: PublicProfile[]
  initialSent: PublicProfile[]
}

function Row({ user, right }: { user: PublicProfile; right?: React.ReactNode }) {
  const inner = (
    <div className="flex items-center gap-3">
      <UserAvatar name={user.display_name || user.username} src={user.avatar_url} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{user.display_name || user.username}</p>
        <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
      </div>
      {right}
    </div>
  )
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
      {user.username ? (
        <Link href={`/u/${user.username}`} className="block active:scale-[0.99] transition-transform">{inner}</Link>
      ) : inner}
    </div>
  )
}

export default function FriendsView({ myUsername, initialFriends, initialIncoming, initialSent }: Props) {
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState(initialFriends)
  const [incoming, setIncoming] = useState(initialIncoming)
  const [sent, setSent] = useState(initialSent)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicProfile[]>([])
  const [searching, setSearching] = useState(false)

  const [email, setEmail] = useState('')
  const [emailResult, setEmailResult] = useState<PublicProfile | null | 'none'>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [showQr, setShowQr] = useState(false)

  const statusOf = useMemo(() => {
    const f = new Set(friends.map(u => u.id))
    const i = new Set(incoming.map(u => u.id))
    const s = new Set(sent.map(u => u.id))
    return (id: string): 'friends' | 'incoming' | 'outgoing' | 'none' =>
      f.has(id) ? 'friends' : i.has(id) ? 'incoming' : s.has(id) ? 'outgoing' : 'none'
  }, [friends, incoming, sent])

  // Debounced username search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch { setResults([]) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const addFriend = async (user: PublicProfile) => {
    setSent(prev => [...prev, user]) // optimistic
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: user.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success(`Request sent to @${user.username}`)
    } catch (e: any) {
      setSent(prev => prev.filter(u => u.id !== user.id))
      toast.error(e.message || 'Could not send request')
    }
  }

  const respond = async (user: PublicProfile, accept: boolean) => {
    setIncoming(prev => prev.filter(u => u.id !== user.id))
    if (accept) setFriends(prev => [...prev, user])
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_id: user.id, accept }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success(accept ? `You're now friends with @${user.username}` : 'Request declined')
    } catch (e: any) {
      setIncoming(prev => [...prev, user])
      if (accept) setFriends(prev => prev.filter(u => u.id !== user.id))
      toast.error(e.message || 'Could not respond')
    }
  }

  const removeFriend = async (user: PublicProfile) => {
    setFriends(prev => prev.filter(u => u.id !== user.id))
    try {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_id: user.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success(`Unfriended @${user.username}`)
    } catch (e: any) {
      setFriends(prev => [...prev, user])
      toast.error(e.message || 'Could not unfriend')
    }
  }

  const lookupEmail = async () => {
    if (!email.trim()) return
    setEmailLoading(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/users/find-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      setEmailResult(data.user ?? 'none')
    } catch {
      toast.error('Lookup failed')
    } finally {
      setEmailLoading(false)
    }
  }

  const inviteLink = typeof window !== 'undefined' && myUsername ? `${window.location.origin}/u/${myUsername}` : ''

  const addButton = (user: PublicProfile) => {
    const status = statusOf(user.id)
    if (status === 'friends') return <span className="rounded-full bg-sage-subtle px-3 py-1.5 text-xs font-bold text-sage">Friends</span>
    if (status === 'outgoing') return <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">Pending</span>
    if (status === 'incoming') return (
      <button onClick={(e) => { e.preventDefault(); respond(user, true) }} className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground active:scale-[0.95]">Accept</button>
    )
    return (
      <button onClick={(e) => { e.preventDefault(); addFriend(user) }} className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground active:scale-[0.95]">
        <UserPlus className="h-3.5 w-3.5" /> Add
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="p-1 -ml-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Friends</h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-2xl bg-muted p-1">
        {([['friends', 'Friends'], ['requests', 'Requests'], ['find', 'Find people']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
            {key === 'requests' && incoming.length > 0 && (
              <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-brand-foreground">{incoming.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Friends tab */}
      {tab === 'friends' && (
        friends.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No friends yet. Use <button className="font-bold text-brand" onClick={() => setTab('find')}>Find people</button> to connect.
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map(u => (
              <Row key={u.id} user={u} right={
                <button
                  onClick={(e) => { e.preventDefault(); removeFriend(u) }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                >Unfriend</button>
              } />
            ))}
          </div>
        )
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Incoming</p>
            {incoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {incoming.map(u => (
                  <Row key={u.id} user={u} right={
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.preventDefault(); respond(u, true) }} className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-foreground active:scale-[0.95]" aria-label="Accept">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.preventDefault(); respond(u, false) }} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground active:scale-[0.95]" aria-label="Decline">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  } />
                ))}
              </div>
            )}
          </div>
          {sent.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sent</p>
              <div className="space-y-2">
                {sent.map(u => (
                  <Row key={u.id} user={u} right={
                    <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </span>
                  } />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Find people tab */}
      {tab === 'find' && (
        <div className="space-y-6">
          {/* Username search */}
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="bg-card pl-9"
              />
            </div>
            <div className="mt-3 space-y-2">
              {searching && <p className="text-center text-sm text-muted-foreground">Searching…</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">No one found.</p>
              )}
              {results.map(u => <Row key={u.id} user={u} right={addButton(u)} />)}
            </div>
          </div>

          {/* Email lookup */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Find by email</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  type="email"
                  autoCapitalize="none"
                  className="bg-card pl-9"
                  onKeyDown={e => e.key === 'Enter' && lookupEmail()}
                />
              </div>
              <button
                onClick={lookupEmail}
                disabled={emailLoading || !email.trim()}
                className="rounded-xl bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
              >
                {emailLoading ? '…' : 'Find'}
              </button>
            </div>
            {emailResult === 'none' && (
              <p className="mt-2 text-sm text-muted-foreground">No PrepTable user with that email.</p>
            )}
            {emailResult && emailResult !== 'none' && (
              <div className="mt-2"><Row user={emailResult} right={addButton(emailResult)} /></div>
            )}
          </div>

          {/* Invite link + QR */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Invite a friend</p>
            {myUsername ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">Share your profile link — anyone can add you from it.</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-xs text-foreground">{inviteLink || `/u/${myUsername}`}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(inviteLink); toast.success('Link copied') }}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background active:scale-[0.95]"
                    aria-label="Copy invite link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowQr(s => !s)}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl active:scale-[0.95] ${showQr ? 'bg-brand text-brand-foreground' : 'bg-muted text-foreground'}`}
                    aria-label="Show QR code"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>
                {showQr && inviteLink && (
                  <div className="mt-4 flex justify-center">
                    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border">
                      <QRCode value={inviteLink} size={180} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link href="/profile" className="font-bold text-brand">Set a username</Link> to get your shareable invite link.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
