'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCacheInvalidation } from '@/lib/queries/hooks'
import Link from 'next/link'
import { ArrowLeft, Camera, LogOut, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'
import { validateUsername } from '@/lib/username'
import HouseholdCard, { HouseholdData } from './household-card'

interface Identity {
  username: string
  display_name: string
  avatar_url: string
}

export default function ProfileEditor({
  initial,
  email,
  household,
}: {
  initial: Identity
  email: string
  household: HouseholdData | null
}) {
  const router = useRouter()
  const invalidate = useCacheInvalidation()
  const [username, setUsername] = useState(initial.username)
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty =
    username.trim().toLowerCase() !== initial.username ||
    displayName.trim() !== initial.display_name ||
    avatarUrl !== initial.avatar_url

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAvatarUrl(data.url)
      toast.success('Photo updated — remember to save')
    } catch (e: any) {
      toast.error(e.message || 'Could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const err = validateUsername(username)
    if (err) { setUsernameError(err); return }
    setUsernameError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'username_taken' || data.code === 'invalid') {
          setUsernameError(data.error)
          return
        }
        throw new Error(data.error || 'Failed to save')
      }
      toast.success('Profile saved')
      invalidate.meChanged()
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-24">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          className="p-1 -ml-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Profile</h1>
        <Link
          href="/settings"
          title="Settings"
          className="ml-auto grid h-11 w-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-card ring-1 ring-border transition-all hover:text-foreground active:scale-[0.95]"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      {/* Avatar */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative rounded-full transition-transform active:scale-[0.97]"
          aria-label="Change photo"
        >
          <UserAvatar name={displayName || username} src={avatarUrl} size={96} />
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand text-brand-foreground shadow-md ring-2 ring-background">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Display name</label>
          <Input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            className="bg-card"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Username</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-brand/40">
            <span className="text-muted-foreground">@</span>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value.toLowerCase()); setUsernameError(null) }}
              placeholder="handle"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {usernameError ? (
            <p className="mt-1.5 text-xs font-medium text-destructive">{usernameError}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Your public handle. Friends find you at /u/{username || 'handle'}.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
          <p className="rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <Button
        onClick={save}
        disabled={saving || uploading || !dirty}
        className="mt-8 h-12 w-full rounded-xl bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </Button>

      <HouseholdCard initialHousehold={household} />

      <form action="/auth/signout" method="POST" className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </div>
  )
}
