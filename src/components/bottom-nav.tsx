'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, CalendarDays, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/planner/grocery', label: 'Grocery', icon: ShoppingCart },
]

export default function BottomNav() {
  const pathname = usePathname()

  // Don't show on login or during onboarding
  if (pathname === '/login' || pathname.startsWith('/onboarding')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {nav.map(({ href, label, icon: Icon }) => {
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
              <span className={cn('text-xs font-medium', active && 'font-semibold')}>
                {label}
              </span>
              {/* Active dot indicator */}
              {active && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
