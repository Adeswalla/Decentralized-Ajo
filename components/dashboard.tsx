'use client';

import React from 'react';
import { useWallet } from '@/lib/wallet-context';
import { DashboardCard } from './dashboard-card';
import { Button } from '@/components/ui/button';
import { Wallet, Info } from 'lucide-react';

interface AjoGroup {
  id: string;
  name: string;
  balance: string | number;
  nextCycle: string;
}

interface DashboardProps {
  activeGroups: AjoGroup[];
}

export const Dashboard: React.FC<DashboardProps> = ({ activeGroups }) => {
  const { isConnected, connectWallet, isLoading } = useWallet();

  // 1. Wallet Connection Handling
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-blue-50 rounded-full text-blue-600 mb-6 border-4 border-blue-100">
          <Wallet size={48} />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">Wallet Disconnected</h2>
        <p className="text-muted-foreground mb-8 max-w-md text-center">
          Please connect your Stellar wallet to view your Ajo groups, pooled balances, and next payouts.
        </p>
        <Button 
          onClick={connectWallet} 
          disabled={isLoading}
          size="lg"
          className="px-8 font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* 2. Dashboard Header */}
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-2">
          My Ajo Overview
        </h1>
        <p className="text-muted-foreground text-lg">
          Track your active deposits and pooled savings in real-time.
        </p>
      </header>

      {/* 3. & 4. Data Rendering and Grid Responsiveness */}
      {activeGroups.length > 0 ? (
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
          </div>
          <h3 className="text-xl font-semibold mb-2">No Active Groups</h3>
          <p className="text-muted-foreground max-w-sm">
            You have not joined any Ajo groups yet. Explore available circles and start saving together!
          </p>
          <Button variant="outline" className="mt-6" onClick={() => window.location.href = '/circles'}>
            Find Ajo Groups
          </Button>
        </div>
      )}
    </div>
  );
};
