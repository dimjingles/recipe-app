'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trophy,
  User,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const LINKS = [
  { href: '/profile', label: 'Edit profile', description: 'Name, username & photo', icon: User },
  { href: '/profile', label: 'Household', description: 'Share recipes & plans', icon: Users },
  { href: '/skills', label: 'Skills', description: 'Techniques & badges', icon: Trophy },
]

export default function SettingsView({ email, version }: { email: string; version: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="mb-2.5 text-sm font-semibold text-foreground">Appearance</h2>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg py-3 text-xs font-semibold transition-all active:scale-[0.97]',
                  active
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={active}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>
      </section>

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

      {/* Sign out */}
      <form action="/auth/signout" method="POST">
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
