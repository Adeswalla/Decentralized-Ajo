'use client';

import React from 'react';
import { Info, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardCard } from './dashboard-card';
import { DashboardCardSkeleton } from './dashboard-card-skeleton';
import { DashboardSkeleton } from './dashboard/dashboard-skeleton';
import { UpcomingCycles } from './dashboard/upcoming-cycles';
import { UpcomingCyclesSkeleton } from './dashboard/upcoming-cycles-skeleton';
import { useWallet } from '@/lib/wallet-context';

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

export const Dashboard: React.FC<DashboardProps> = ({
  activeGroups,
  loading = false,
}) => {
  const { isConnected, connectWallet, isLoading } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] w-full flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="mb-6 rounded-full border-4 border-primary/20 bg-primary/10 p-6 text-primary">
          <Wallet size={48} />
        </div>
        <h2 className="mb-3 text-center text-3xl font-bold text-foreground">
          Connect Your Wallet
        </h2>
        <p className="mb-8 max-w-md text-center text-muted-foreground">
          Connect your Stellar wallet to view your Ajo groups, pooled balances,
          and upcoming payment cycles.
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <section className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Ajo Overview
          </h1>
          <p className="mt-1 text-muted-foreground">
            Track your active deposits and pooled savings in real time.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <DashboardCardSkeleton key={item} />
                ))}
              </div>
            ) : activeGroups.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-muted/20 p-12 text-center">
                <div className="mb-4 rounded-full bg-muted p-4 text-muted-foreground">
                  <Info size={32} />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  No Active Groups
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  You haven&apos;t joined any active Ajo circles yet. Create or
                  join one to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    window.location.href = '/circles/join';
                  }}
                >
                  Find Ajo Groups
                </Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            {loading ? <UpcomingCyclesSkeleton /> : <UpcomingCycles />}
          </div>
        </div>
      </div>
    </section>
  );
};
