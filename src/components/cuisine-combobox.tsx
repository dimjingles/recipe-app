'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRecipes } from '@/lib/queries/hooks'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function CuisineCombobox({ value, onChange, placeholder = 'e.g. Italian', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // The cuisines already in the user's library, from the cached recipe list —
  // no request of its own.
  const recipes = useRecipes()
  const suggestions = useMemo(
    () => Array.from(
      new Set((recipes.data ?? []).map(r => r.cuisine?.toLowerCase()).filter((c): c is string => !!c))
    ).sort(),
    [recipes.data],
  )

  const safeValue = typeof value === 'string' ? value : ''
  const filtered = safeValue.trim()
    ? suggestions.filter(s => s.includes(safeValue.toLowerCase().trim()) && s !== safeValue.toLowerCase().trim())
    : suggestions

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={safeValue}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(cuisine => (
            <li
              key={cuisine}
              onMouseDown={e => {
                e.preventDefault()
                onChange(cuisine.charAt(0).toUpperCase() + cuisine.slice(1))
                setOpen(false)
              }}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer capitalize"
            >
              {cuisine}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
