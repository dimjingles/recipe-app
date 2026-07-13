'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Trophy,
  User,
  Users,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { ChefPreferences } from '@/lib/cook/chef-preferences'
import ChefPreferencesCard from './chef-preferences-card'
import { clearPersistedCache } from '@/components/query-provider'

const LINKS = [
  { href: '/profile', label: 'Edit profile', description: 'Name, username & photo', icon: User },
  { href: '/profile', label: 'Household', description: 'Share recipes & plans', icon: Users },
  { href: '/skills', label: 'Skills', description: 'Techniques & badges', icon: Trophy },
]

export default function SettingsView({
  email,
  version,
  chef,
}: {
  email: string
  version: string
  chef: ChefPreferences
}) {
  const queryClient = useQueryClient()
  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-24">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          className="p-1 -ml-1 text-muted-foreground transition-all hover:text-foreground active:scale-[0.95]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Settings</h1>
      </div>

      {/* Account */}
      <section className="mb-8">
        <h2 className="mb-2.5 text-sm font-semibold text-foreground">Account</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {LINKS.map(({ href, label, description, icon: Icon }, i) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 active:bg-muted',
                i > 0 && 'border-t border-border',
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
        <p className="mt-2.5 px-1 text-xs text-muted-foreground">Signed in as {email}</p>
      </section>

      {/* Cook with AI */}
      <ChefPreferencesCard initial={chef} />

      {/* Sign out — drop the persisted query cache so no user data survives
          on a shared device; the form then posts and redirects as before. */}
      <form action="/auth/signout" method="POST" onSubmit={() => clearPersistedCache(queryClient)}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">PrepTable · v{version}</p>
    </div>
  )
}
