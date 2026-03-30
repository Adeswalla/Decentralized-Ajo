'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleDot, LayoutDashboard, PlusCircle, Users, ArrowLeftRight, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export const navLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/circles/create', label: 'Create Circle', icon: PlusCircle },
  { href: '/circles/join', label: 'Join Circle', icon: Users },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/profile', label: 'Profile', icon: Wallet },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {navLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            pathname === href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r bg-background h-screen sticky top-0 p-4 gap-6">
      <div className="flex items-center gap-2 font-semibold text-lg">
        <CircleDot className="h-5 w-5 text-primary" />
        <span>Stellar Ajo</span>
      </div>
      <SidebarNav />
    </aside>
  );
}
