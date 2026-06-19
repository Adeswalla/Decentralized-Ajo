'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, User, Home } from 'lucide-react'

const navigation = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/groups/create', label: 'Create Group', icon: Plus },
  { href: '/profile', label: 'My Wallet', icon: User },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 border-r border-border bg-card/30 glass flex-col">
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-stellar/20 text-stellar font-medium border border-stellar/30'
                  : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          <p className="font-medium">Stellar Network</p>
          <p className="text-xs opacity-75">Public Testnet</p>
        </div>
      </div>
    </aside>
  )
}
