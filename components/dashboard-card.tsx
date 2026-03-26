'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Calendar, TrendingUp } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  pooledBalance: string | number;
  nextPayout: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  pooledBalance,
  nextPayout,
}) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 overflow-hidden group">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold group-hover:text-blue-600 transition-colors">
            {title}
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-full text-green-600">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Pooled Balance
            </p>
            <p className="text-lg font-mono font-bold text-foreground">
              {typeof pooledBalance === 'number' ? `${pooledBalance.toLocaleString()} XLM` : pooledBalance}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-full text-orange-600">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Next Payout
            </p>
            <p className="text-md font-medium text-foreground">{nextPayout}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 border-t bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet size={14} />
          <span>Soroban Certified</span>
        </div>
      </CardFooter>
    </Card>
  );
};
