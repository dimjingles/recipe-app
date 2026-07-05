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
          'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[64px]',
          'active:scale-[0.92]',
          active ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className={cn('w-5 h-5', active && 'stroke-[2.5px]')} />
        <span className={cn('text-xs font-medium', active && 'font-semibold')}>{label}</span>
        {active && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
        )}
      </Link>
    )
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {LEFT_NAV.map(item => navLink(item))}

        {/* Center add button — goes directly to write recipe page */}
        <Link
          href="/recipes/new"
          className="flex flex-col items-center active:scale-[0.92] transition-all"
          aria-label="Add recipe"
        >
          <span className="w-12 h-12 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-lg hover:bg-brand/90 -mt-5">
            <Plus className="w-6 h-6" />
          </span>
        </Link>

        {RIGHT_NAV.map(item => navLink(item))}
      </div>
    </nav>
  )
}
