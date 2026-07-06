'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, CalendarDays, ShoppingCart, Plus, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEFT_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
]

const RIGHT_NAV = [
  { href: '/skills', label: 'Skills', icon: Trophy },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/planner/grocery', label: 'Grocery', icon: ShoppingCart },
]

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname.startsWith('/onboarding')) return null

  const navLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
    const active =
      pathname === href ||
      (href !== '/' &&
        pathname.startsWith(href) &&
        !(href === '/planner' && pathname === '/planner/grocery'))

    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'relative flex min-w-[58px] flex-col items-center gap-1 rounded-full px-3 py-2 transition-all',
          'active:scale-[0.92]',
          active
            ? 'bg-muted text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
      >
        <Icon className={cn('h-5 w-5', active && 'stroke-[2.6px]')} />
        <span className={cn('text-[11px] font-semibold leading-none', active && 'text-foreground')}>
          {label}
        </span>
        {active && (
          <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />
        )}
      </Link>
    )
  }

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-lg px-4 safe-area-pb">
      <div className="flex items-center justify-between rounded-full border border-border bg-card/95 p-2 shadow-float backdrop-blur-xl">
        {LEFT_NAV.map(item => navLink(item))}

        <Link
          href="/recipes/new"
          className="mx-1 flex items-center justify-center active:scale-[0.92] transition-all"
          aria-label="Add recipe"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-float hover:bg-foreground/90">
            <Plus className="h-7 w-7" />
          </span>
        </Link>

        {RIGHT_NAV.map(item => navLink(item))}
      </div>
    </nav>
  )
}
