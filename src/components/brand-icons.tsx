// Brand marks for the social import options (lucide has no TikTok / brand-colored marks).

export function YouTubeIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="4.5" width="22" height="15" rx="4" fill="#FF0000" />
      <path d="M10 8.75v6.5L15.8 12 10 8.75z" fill="white" />
    </svg>
  )
}

export function TikTokIcon({ className = 'h-6 w-6' }: { className?: string }) {
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

export function InstagramIcon({ className = 'h-6 w-6' }: { className?: string }) {
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
