'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  token: string
  info: { household_id: string; name: string } | null
  alreadyInHousehold: boolean
}

export default function JoinHousehold({ token, info, alreadyInHousehold }: Props) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)

  const join = async () => {
    setJoining(true)
    try {
      const res = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('You joined the household')
      router.push('/profile')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not join')
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-subtle">
        <Home className="h-8 w-8 text-brand" />
      </div>

      {!info ? (
        <>
          <h1 className="font-heading text-2xl font-bold text-foreground">Invite not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This invite link is invalid or has expired.</p>
          <Link href="/" className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background">Go home</Link>
        </>
      ) : alreadyInHousehold ? (
        <>
          <h1 className="font-heading text-2xl font-bold text-foreground">Already in a household</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Leave your current household before joining <span className="font-semibold">{info.name}</span>.
          </p>
          <Link href="/profile" className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background">Go to profile</Link>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-bold text-foreground">Join {info.name}?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll share this household&apos;s recipe library and cookbooks. Your recipe rankings stay personal.
          </p>
          <button
            onClick={join}
            disabled={joining}
            className="mt-6 flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-brand-foreground disabled:opacity-60"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Join household
          </button>
          <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">Not now</Link>
        </>
      )}
    </div>
  )
}
