'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Share2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { format, addDays } from 'date-fns'
import { Shimmer } from '@/components/ui/shimmer'
import { EmptyState, BasketIllustration } from '@/components/ui/empty-state'

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥦', dairy: '🧀', meat: '🥩', seafood: '🐟',
  pantry: '🫙', spices: '🌿', bakery: '🍞', frozen: '🧊', other: '📦',
}

interface GroceryItem {
  name: string
  quantity: number
  displayQty: string
  unit: string
  category: string
  recipes: string[]
}

interface GroceryData {
  grouped: Record<string, GroceryItem[]>
  items: GroceryItem[]
}

export default function GroceryList({ weekStart }: { weekStart: string }) {
  const [data, setData] = useState<GroceryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const weekEnd = addDays(new Date(weekStart + 'T00:00:00'), 6)

  useEffect(() => {
    fetch(`/api/planner/grocery?week_start=${weekStart}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))

    // Load checked state from localStorage
    const stored = localStorage.getItem(`grocery-checked-${weekStart}`)
    if (stored) {
      try { setChecked(new Set(JSON.parse(stored))) } catch {}
    }
  }, [weekStart])

  const toggleCheck = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(`grocery-checked-${weekStart}`, JSON.stringify([...next]))
      return next
    })
  }

  const shareList = async () => {
    if (!data) return
    const lines: string[] = [`🛒 Grocery List — ${format(new Date(weekStart + 'T00:00:00'), 'MMM d')} – ${format(weekEnd, 'MMM d')}\n`]
    for (const [cat, items] of Object.entries(data.grouped)) {
      lines.push(`\n${CATEGORY_EMOJI[cat] ?? '📦'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`)
      for (const item of items) {
        const qty = item.displayQty ? `${item.displayQty} ${item.unit}` : ''
        lines.push(`• ${item.name}${qty ? ` (${qty.trim()})` : ''}`)
      }
    }
    const text = lines.join('\n')
    if (navigator.share) {
      await navigator.share({ title: 'Grocery List', text })
    } else {
      await navigator.clipboard.writeText(text)
      alert('Grocery list copied to clipboard!')
    }
  }

  const totalItems = data?.items.length ?? 0
  const checkedCount = checked.size

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/planner" className="text-muted-foreground hover:text-foreground p-1 -ml-1 active:scale-[0.95] transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand" />
              Grocery List
            </h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(weekStart + 'T00:00:00'), 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        {totalItems > 0 && (
          <button
            onClick={shareList}
            className="flex items-center gap-1.5 bg-brand-subtle text-brand rounded-full px-3 py-1.5 text-sm font-medium hover:bg-brand/20 active:scale-[0.97] transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm px-4 py-3 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-muted-foreground">{checkedCount}/{totalItems} items</span>
            {checkedCount === totalItems && totalItems > 0 && (
              <span className="text-xs text-sage font-medium">✅ All done!</span>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Shimmer key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !data || totalItems === 0 ? (
        <EmptyState
          illustration={<BasketIllustration />}
          title="No items yet"
          description="Add recipes to your meal plan to generate a grocery list."
          action={
            <Link
              href="/planner"
              className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              Go to Planner
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(data.grouped).map(([category, items]) => (
            <div key={category} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Sage-tinted category header (ingredients section) */}
              <div className="px-4 py-2.5 bg-sage-subtle border-b border-sage/15">
                <h3 className="text-xs font-semibold text-sage uppercase tracking-wide flex items-center gap-1.5">
                  <span>{CATEGORY_EMOJI[category] ?? '📦'}</span>
                  {category}
                  <span className="ml-auto text-sage/60 font-normal normal-case">
                    {items.filter(i => checked.has(`${category}-${i.name}`)).length}/{items.length}
                  </span>
                </h3>
              </div>
              <ul className="divide-y divide-border/50">
                {items.map((item) => {
                  const key = `${category}-${item.name}`
                  const isChecked = checked.has(key)
                  return (
                    <li key={key}>
                      <button
                        onClick={() => toggleCheck(key)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted active:scale-[0.99] active:bg-muted transition-all text-left"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-brand border-brand' : 'border-border'
                        }`}>
                          {isChecked && (
                            <svg className="w-3 h-3 text-brand-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.name}
                          </span>
                          {item.recipes.length > 1 && (
                            <p className="text-xs text-muted-foreground truncate">
                              for {item.recipes.slice(0, 2).join(', ')}{item.recipes.length > 2 ? ` +${item.recipes.length - 2}` : ''}
                            </p>
                          )}
                        </div>
                        {(item.displayQty || item.unit) && (
                          <span className={`text-sm font-medium shrink-0 ${isChecked ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {item.displayQty} {item.unit}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {checkedCount > 0 && (
            <button
              onClick={() => {
                setChecked(new Set())
                localStorage.removeItem(`grocery-checked-${weekStart}`)
              }}
              className="text-sm text-muted-foreground hover:text-foreground text-center w-full py-2 active:scale-[0.98] transition-all"
            >
              Clear all checks
            </button>
          )}
        </div>
      )}
    </div>
  )
}
