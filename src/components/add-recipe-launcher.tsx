'use client'

import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'

// The add-recipe sheet is a large component most visits never open: load its
// code on first intent (hover / touch) instead of with the page.
export const loadAddRecipeSheet = () => import('@/components/add-recipe-sheet')
/** The sheet, code-split: call loadAddRecipeSheet() on intent to warm it. */
export const LazyAddRecipeSheet = dynamic(() => loadAddRecipeSheet().then(m => m.AddRecipeSheet), { ssr: false })

/**
 * Drop-in trigger: renders its children as a button that opens the
 * Add-a-recipe sheet, without the caller managing state.
 */
export function AddRecipeLauncher({
  className,
  children,
  ariaLabel = 'Add recipe',
}: {
  className?: string
  children: ReactNode
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  return (
    <>
      <button
        onClick={() => { setEverOpened(true); setOpen(true) }}
        onPointerEnter={() => void loadAddRecipeSheet()}
        onPointerDown={() => void loadAddRecipeSheet()}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </button>
      {/* Mounted from the first open on, so an in-progress add survives closing. */}
      {everOpened && <LazyAddRecipeSheet open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
