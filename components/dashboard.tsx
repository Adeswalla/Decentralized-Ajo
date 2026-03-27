'use client';

import React from 'react';
import { useWallet } from '@/lib/wallet-context';
import { DashboardCard } from './dashboard-card';
import { DashboardCardSkeleton } from './dashboard-card-skeleton';
import { UpcomingCycles } from './dashboard/upcoming-cycles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Info } from 'lucide-react';

interface AjoGroup {
  id: string;
  name: string;
  balance: string | number;
  nextCycle: string;
}

interface DashboardProps {
  activeGroups: AjoGroup[];
  loading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeGroups, loading = false }) => {
  const { isConnected, connectWallet, isLoading } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-primary/10 rounded-full text-primary mb-6 border-4 border-primary/20">
          <Wallet size={48} />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3 text-center">Connect Your Wallet</h2>
        <p className="text-muted-foreground mb-8 max-w-md text-center">
          Connect your Stellar wallet to view your Ajo groups, pooled balances, and upcoming payment cycles.
        </p>
        <Button
          onClick={connectWallet}
          disabled={isLoading}
          size="lg"
          className="px-8 font-semibold"
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">My Ajo Overview</h1>
          <p className="text-muted-foreground mt-1">
            Track your active deposits and pooled savings in real-time.
          </p>
        </header>

      {/* 3. & 4. Data Rendering and Grid Responsiveness */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
      ) : activeGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeGroups.map((group) => (
            <DashboardCard
              key={group.id}
              title={group.name}
              pooledBalance={group.balance}
              nextPayout={group.nextCycle}
            />
          ))}
        </div>
      ) : (
        /* 6. Edge Cases - Empty State */
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl bg-muted/20 text-center">
          <div className="p-4 bg-muted rounded-full text-muted-foreground mb-4">
            <Info size={32} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active group cards — takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : activeGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGroups.map((group: AjoGroup) => (
                  <DashboardCard
                    key={group.id}
                    title={group.name}
                    pooledBalance={group.balance}
                    nextPayout={group.nextCycle}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl bg-muted/20 text-center h-full min-h-[180px]">
                <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">
                  <Info size={28} />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Active Groups</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  You haven't joined any active Ajo circles yet. Create or join one to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => (window.location.href = '/circles/join')}
                >
                  Find Ajo Groups
                </Button>
              </div>
            )}
          </div>

          {/* Upcoming cycles sidebar */}
          <div className="lg:col-span-1">
            <UpcomingCycles />
          </div>
        </div>
      </div>
    </div>
  );
};
