'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Plus, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEFT_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
]

const RIGHT_NAV = [
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname.startsWith('/onboarding') || pathname.startsWith('/share/') || pathname.endsWith('/cook')) return null

  const navLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href))

    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex min-w-[58px] flex-col items-center gap-1 rounded-full px-3 py-2 transition-all',
          'active:scale-[0.92]',
          active
            ? 'glass-pill text-foreground'
            : 'text-muted-foreground hover:bg-white/45 hover:text-foreground',
        )}
      >
        <Icon className={cn('h-5 w-5', active && 'stroke-[2.6px]')} />
        <span className={cn('text-[11px] font-semibold leading-none', active && 'text-foreground')}>
          {label}
        </span>
      </Link>
    )
  }

  // The main call to action: a green bubble in the middle of the bar. Search is
  // where recipes get found or added. On the mobile bar the bubble rises a little
  // above its slot so its label lines up with the others and the bar keeps its
  // height; on the desktop rail it sits in line.
  const searchActive = pathname.startsWith('/search')
  const searchLink = (
    <Link
      key="/search"
      href="/search"
      aria-label="Search or add a recipe"
      className="group flex min-w-[58px] flex-col items-center gap-1 rounded-full px-3 py-2 transition-all active:scale-[0.92] md:py-1.5"
    >
      <span
        className={cn(
          '-mt-5 grid h-10 w-10 place-items-center rounded-full bg-sage text-sage-foreground shadow-float transition-colors group-hover:bg-sage/90 md:mt-0',
          searchActive && 'ring-2 ring-sage/30 ring-offset-2 ring-offset-transparent',
        )}
      >
        <Plus className="h-5 w-5 stroke-[2.6px]" />
      </span>
      <span
        className={cn(
          'text-[11px] font-semibold leading-none',
          searchActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        Search
      </span>
    </Link>
  )

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-lg px-4 safe-area-pb md:inset-x-auto md:left-4 md:top-1/2 md:bottom-auto md:max-w-none md:-translate-y-1/2 md:px-0">
      <div className="glass-bar flex items-center justify-between rounded-full p-2 md:flex-col md:rounded-2xl">
        {LEFT_NAV.map(item => navLink(item))}
        {searchLink}
        {RIGHT_NAV.map(item => navLink(item))}
      </div>
    </nav>
  )
}
