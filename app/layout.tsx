import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { WalletProvider } from '@/lib/wallet-context'
import { NotificationBell } from '@/components/notifications/notification-bell'
import Link from 'next/link'
import { CircleDot } from 'lucide-react'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Stellar Ajo - Decentralized Savings Circle',
  description: 'A decentralized savings circle application on the Stellar Network.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <WalletProvider>
          <div className="flex flex-col min-h-screen">
            <header className="border-b bg-card sticky top-0 z-50">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                  <CircleDot className="h-6 w-6 text-primary" />
                  <span>Stellar Ajo</span>
                </Link>
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                  <Link href="/dashboard" className="transition-colors hover:text-primary">Dashboard</Link>
                  <Link href="/circles" className="transition-colors hover:text-primary">Circles</Link>
                  <Link href="/transactions" className="transition-colors hover:text-primary">Transactions</Link>
                </nav>
                <div className="flex items-center gap-4">
                  <NotificationBell />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-purple-500" />
                </div>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t py-6 bg-card">
              <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                &copy; 2026 Stellar Ajo. All rights reserved.
              </div>
            </footer>
          </div>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  )
}
