import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '@/frontend/styles/globals.css'
import Navbar from '@/frontend/components/Navbar'
import Sidebar from '@/frontend/components/Sidebar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'DecentralisedAjo - Web3 Savings Platform',
  description: 'A blockchain-based rotating savings app on the Stellar network',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a9cf5' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
