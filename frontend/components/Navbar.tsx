'use client'

import Link from 'next/link'
import { Wallet, Network } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="border-b border-border bg-card/50 glass sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-stellar to-indigo flex items-center justify-center font-bold text-white">
              ∞
            </div>
            <span className="text-lg font-bold hidden sm:inline bg-gradient-to-r from-stellar to-indigo bg-clip-text text-transparent">
              DecentralisedAjo
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/20 transition-colors text-sm text-muted-foreground hover:text-foreground">
              <Network size={18} />
              <span>Stellar Testnet</span>
            </button>
            
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-medium transition-colors">
              <Wallet size={18} />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
