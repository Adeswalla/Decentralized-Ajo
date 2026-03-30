'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatXLM, formatDate } from '@/lib/utils';
import { ArrowUpCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Contribution {
  id: string;
  amount: number;
  round: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  txHash?: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

interface ContributionHistoryProps {
  contributions: Contribution[];
}

export function ContributionHistory({ contributions }: ContributionHistoryProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <ArrowUpCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'COMPLETED':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'FAILED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution History</CardTitle>
        <CardDescription>
          Timeline of all contributions to this circle
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contributions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No contributions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contributions.map((contribution, index) => {
              const displayName =
                contribution.user.firstName && contribution.user.lastName
                  ? `${contribution.user.firstName} ${contribution.user.lastName}`
                  : 'Member';

              return (
                <div
                  key={contribution.id}
                  className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">{getStatusIcon(contribution.status)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{displayName}</p>
                      <p className="text-lg font-bold">{formatXLM(contribution.amount)} XLM</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Round {contribution.round}</span>
                      <span>•</span>
                      <span>{formatDate(contribution.createdAt)}</span>
                    </div>
                    {contribution.txHash && (
                      <p className="text-xs font-mono text-muted-foreground">
                        TX: {contribution.txHash.slice(0, 16)}...{contribution.txHash.slice(-8)}
                      </p>
                    )}
                  </div>
                  <Badge variant={getStatusVariant(contribution.status)}>
                    {contribution.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
