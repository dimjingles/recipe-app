'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  PenLine,
  Send,
} from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Platform = 'youtube' | 'tiktok' | 'instagram'
type View = 'options' | 'platforms' | Platform

const PLATFORMS: Array<{ key: Platform; label: string; appUrl: string; shareVerb: string }> = [
  { key: 'youtube', label: 'YouTube', appUrl: 'https://www.youtube.com', shareVerb: 'Share' },
  { key: 'tiktok', label: 'TikTok', appUrl: 'https://www.tiktok.com', shareVerb: 'Share' },
  { key: 'instagram', label: 'Instagram', appUrl: 'https://www.instagram.com', shareVerb: 'Send' },
]

// ── Brand icons (lucide has no TikTok / brand-colored marks) ─────────────────

function YouTubeIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="4.5" width="22" height="15" rx="4" fill="#FF0000" />
      <path d="M10 8.75v6.5L15.8 12 10 8.75z" fill="white" />
    </svg>
  )
}

function TikTokIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#010101" />
      <path
        d="M16.6 6.33a3.87 3.87 0 0 1-.9-2.53h-2.6v10.53a2.19 2.19 0 1 1-2.19-2.28c.23 0 .45.04.66.1V9.5a4.85 4.85 0 0 0-.66-.05 4.83 4.83 0 1 0 4.83 4.83V9.4a6.37 6.37 0 0 0 3.72 1.19V8a3.85 3.85 0 0 1-2.86-1.67z"
        fill="white"
      />
    </svg>
  )
}

function InstagramIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FD5949" />
          <stop offset="35%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="white" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="white" strokeWidth="1.6" />
      <circle cx="15.6" cy="8.4" r="0.9" fill="white" />
    </svg>
  )
}

const PLATFORM_ICON: Record<Platform, (props: { className?: string }) => ReactNode> = {
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

interface AddRecipeSheetProps {
  open: boolean
  onClose: () => void
}

export function AddRecipeSheet({ open, onClose }: AddRecipeSheetProps) {
  const router = useRouter()
  const [view, setView] = useState<View>('options')
  const [link, setLink] = useState('')
  const [navigating, setNavigating] = useState(false)

  const close = () => {
    onClose()
    // Reset after the sheet unmounts so the next open starts fresh.
    setView('options')
    setLink('')
    setNavigating(false)
  }

  const go = (href: string) => {
    setNavigating(true)
    router.push(href)
    close()
  }

  const header = (title: string, back?: () => void) => (
    <div className="relative mb-5 flex h-9 items-center justify-center">
      <button
        onClick={back ?? close}
        className="absolute left-0 grid h-9 w-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
        aria-label={back ? 'Back' : 'Close'}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
    </div>
  )

  const platform = PLATFORMS.find(p => p.key === view)

  return (
    <BottomSheet open={open} onClose={close} maxHeight="90vh">
      <div className="px-5 pb-8 pt-1">
        {/* ── View 1: Add a recipe ── */}
        {view === 'options' && (
          <>
            {header('Add a recipe')}

            <button
              onClick={() => setView('platforms')}
              className="mb-3 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
            >
              <span className="flex shrink-0 -space-x-1.5">
                <InstagramIcon className="h-7 w-7 drop-shadow-sm" />
                <TikTokIcon className="h-7 w-7 drop-shadow-sm" />
                <YouTubeIcon className="h-7 w-7 drop-shadow-sm" />
              </span>
              <span>
                <span className="block font-heading text-base font-bold text-foreground">
                  Import from social media
                </span>
                <span className="block text-sm text-muted-foreground">
                  YouTube, TikTok or Instagram videos
                </span>
              </span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Link2, label: 'Import from web', onClick: () => go('/import') },
                { icon: PenLine, label: 'Write from scratch', onClick: () => go('/recipes/new') },
              ].map(({ icon: Icon, label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={navigating}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── View 2: platform picker ── */}
        {view === 'platforms' && (
          <>
            {header('Import from social media', () => setView('options'))}
            <div className="space-y-3">
              {PLATFORMS.map(({ key, label }) => {
                const Icon = PLATFORM_ICON[key]
                return (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                  >
                    <Icon className="h-7 w-7 shrink-0" />
                    <span className="flex-1 text-base font-semibold text-foreground">{label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* ── View 3: platform instructions + paste link ── */}
        {platform && (
          <>
            {header(`Import from ${platform.label}`, () => setView('platforms'))}

            {/* Mock post illustrating where the share button lives */}
            <div className="mx-auto mb-4 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="grid h-32 place-items-center bg-gradient-to-br from-brand-subtle to-sage-subtle">
                <span className="text-5xl">🍝</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <MessageCircle className="h-4 w-4" />
                  <span className="relative grid h-8 w-8 place-items-center">
                    <span className="absolute inset-0 animate-pulse rounded-full bg-brand/15 ring-2 ring-brand" />
                    <Send className="relative h-4 w-4 text-brand" />
                  </span>
                </div>
                <Bookmark className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <ol className="mb-5 space-y-2 text-sm text-muted-foreground">
              {[
                `Open ${platform.label} and find a recipe video`,
                <>Tap <strong className="text-foreground">{platform.shareVerb}</strong> on the video</>,
                <>Choose <strong className="text-foreground">PrepTable</strong> — or copy the link and paste it below</>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-subtle text-[11px] font-bold text-brand">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="mb-3 flex gap-2">
              <Input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={`Paste a ${platform.label} link…`}
                className="flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && /https?:\/\//i.test(link)) {
                    go(`/import?url=${encodeURIComponent(link.trim())}`)
                  }
                }}
              />
              <Button
                onClick={() => go(`/import?url=${encodeURIComponent(link.trim())}`)}
                disabled={!/https?:\/\//i.test(link) || navigating}
                className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
              </Button>
            </div>

            <a
              href={platform.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Open {platform.label} to find a recipe
            </a>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

/**
 * Drop-in trigger: renders its children as a button that opens the
 * Add-a-recipe sheet. Lets server components (e.g. the Home page) offer the
 * sheet without managing state.
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
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} aria-label={ariaLabel}>
        {children}
      </button>
      <AddRecipeSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
