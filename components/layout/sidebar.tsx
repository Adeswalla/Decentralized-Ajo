'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleDot, LayoutDashboard, PlusCircle, Users, ArrowLeftRight, Wallet } from 'lucide-react';
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTxHistory } from '@/hooks/useTxHistory';
import { formatDistanceToNow } from 'date-fns';

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
  const { txHistory } = useTxHistory();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r bg-background h-screen sticky top-0 p-4 gap-6">
      <div className="flex items-center gap-2 font-semibold text-lg">
        <CircleDot className="h-5 w-5 text-primary" />
        <span>Stellar Ajo</span>
      </div>
      <SidebarNav />

      <div className="mt-auto flex flex-col pt-4 border-t">
        <h3 className="text-sm font-semibold mb-3 px-2">Recent Transactions</h3>
        {txHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2">No transactions yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto px-2">
            {txHistory.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between group rounded bg-accent/50 p-2 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="font-medium flex items-center gap-1">
                    {tx.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    {tx.type} 
                  </span>
                  <span className="text-muted-foreground">{formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{tx.hash.slice(0, 8)}</span>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-3 w-3 text-primary" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
