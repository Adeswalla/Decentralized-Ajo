import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { Toaster as HotToaster } from 'react-hot-toast'
import { WalletProvider } from '@/lib/wallet-context'
import { ThemeProvider } from '@/components/theme-provider'
import { Web3Provider } from '@/providers/Web3Provider'
import { Navbar } from '@/components/layout/navbar'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Stellar Ajo - Decentralized Savings Circle',
  description: 'A decentralized savings circle application on the Stellar Network. Pool money, vote on governance, and manage contributions with full transparency.',
  generator: 'v0.app',
  keywords: ['Ajo', 'Esusu', 'Savings Circle', 'Stellar', 'Blockchain', 'Decentralized Finance'],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Web3Provider>
            <WalletProvider>
              <div className="flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1">{children}</main>
              </div>
              <Toaster />
              <HotToaster position="bottom-right" />
            </WalletProvider>
          </Web3Provider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
