'use client'

import Link from 'next/link'
import { ArrowLeft, Bookmark, ChevronRight, CircleCheck, LogOut, Settings, Trophy } from 'lucide-react'
import { useRecipes } from '@/lib/queries/hooks'
import { UserAvatar } from '@/components/user-avatar'

interface Identity {
  username: string
  display_name: string
  avatar_url: string
}

// Read-only profile. Identity edits live on /profile/edit, reached from Settings.
export default function ProfileView({
  profile,
  memberSince,
}: {
  profile: Identity
  memberSince: string | null
}) {
  const recipes = useRecipes()

  // Same split as the recipe library's tabs. Counts stay blank until the
  // recipes query resolves.
  const shortcuts = [
    {
      href: '/recipes?tab=cooked',
      label: 'Cooked',
      icon: <CircleCheck className="h-6 w-6" />,
      count: recipes.data?.filter(r => r.cooked_count > 0).length,
    },
    {
      href: '/recipes?tab=want-to-try',
      label: 'Want to Try',
      icon: <Bookmark className="h-6 w-6 fill-current" />,
      count: recipes.data?.filter(r => r.cooked_count === 0).length,
    },
    { href: '/skills', label: 'Skills', icon: <Trophy className="h-6 w-6" />, count: undefined },
  ]

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

      {/* Avatar + identity */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <UserAvatar name={profile.display_name || profile.username} src={profile.avatar_url} size={96} />
        <div className="flex flex-col items-center gap-0.5 text-center">
          {profile.display_name && (
            <p className="text-xl font-bold text-foreground">{profile.display_name}</p>
          )}
          {profile.username && (
            <p className="text-base font-semibold text-foreground">@{profile.username}</p>
          )}
          {memberSince && (
            <p className="text-sm text-muted-foreground">Member since {memberSince}</p>
          )}
        </div>
      </div>

      {/* Shortcuts into the library tabs and skills */}
      <nav className="-mx-5 mb-8 border-t border-border">
        {shortcuts.map(({ href, label, icon, count }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <span className="shrink-0 text-foreground">{icon}</span>
            <span className="flex-1 text-base font-bold text-foreground">{label}</span>
            {count != null && <span className="text-base font-bold text-foreground">{count}</span>}
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>

      <form action="/auth/signout" method="POST">
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
