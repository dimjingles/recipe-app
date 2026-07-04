import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/bottom-nav'
import { Toaster } from '@/components/ui/sonner'
import ServiceWorkerRegister from '@/components/service-worker-register'

const geist = Geist({ subsets: ['latin'] })

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
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        <main className="pb-20 min-h-screen">
          {children}
        </main>
        <BottomNav />
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
