'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Extra classes on the panel (not the overlay). */
  className?: string
  /** Max-height of the scrollable panel. Default: unconstrained. */
  maxHeight?: string
  /** Stacking level — default (z-50), elevated (z-[60]), top (z-[70]). */
  zIndex?: 'default' | 'elevated' | 'top'
}

const zMap = { default: 'z-50', elevated: 'z-[60]', top: 'z-[70]' } as const

export function BottomSheet({
  open,
  onClose,
  children,
  className = '',
  maxHeight,
  zIndex = 'default',
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/40 ${zMap[zIndex]}`}
      onClick={onClose}
    >
      <div
        className={`bg-card w-full max-w-lg rounded-t-3xl shadow-xl overflow-hidden ${className}`}
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
