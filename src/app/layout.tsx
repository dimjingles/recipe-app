import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/bottom-nav'
import { Toaster } from '@/components/ui/sonner'
import ServiceWorkerRegister from '@/components/service-worker-register'
import { PageTransition } from '@/components/page-transition'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Mise en Place',
  description: 'Your personal recipe & meal planner',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mise en Place',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f97316',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen antialiased">
        <main className="min-h-screen pb-28">
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNav />
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
