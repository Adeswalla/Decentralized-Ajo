import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Calendar, Users } from 'lucide-react';

interface AjoData {
  id: string;
  name: string;
  contractAddress: string;
  contributionAmt: string;
  cycleDuration: number;
  maxMembers: number;
  status: string;
  createdAt: Date;
}

interface DashboardCardProps {
  ajo: AjoData;
}

export default function DashboardCard({ ajo }: DashboardCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{ajo.name}</CardTitle>
          <Badge variant={ajo.status === 'OPEN' ? 'default' : 'secondary'}>
            {ajo.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{ajo.contributionAmt} XLM</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{ajo.cycleDuration} days cycle</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Max {ajo.maxMembers} members</span>
        </div>
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Contract: {ajo.contractAddress.slice(0, 6)}...{ajo.contractAddress.slice(-4)}
        </div>
      </CardContent>
    </Card>
  );
}
