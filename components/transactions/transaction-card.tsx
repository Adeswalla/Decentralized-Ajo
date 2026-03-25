'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface Transaction {
  id: string;
  amount: number;
  round: number;
  status: string;
  createdAt: string;
  circle: { id: string; name: string };
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  COMPLETED: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};

interface TransactionCardProps {
  transaction: Transaction;
}

export function TransactionCard({ transaction: tx }: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid="transaction-card"
      className="p-4 space-y-2 rounded-lg shadow-sm border bg-card"
    >
      {/* Primary row: amount + status */}
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-base">
          {tx.amount.toFixed(2)} XLM
        </span>
        <Badge variant={statusVariant[tx.status] ?? 'secondary'}>
          {tx.status}
        </Badge>
      </div>

      {/* Circle link */}
      <div className="text-sm">
        <span className="text-muted-foreground">Circle: </span>
        <Link
          href={`/circles/${tx.circle.id}`}
          className="font-medium hover:underline text-foreground"
        >
          {tx.circle.name}
        </Link>
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground">
        {new Date(tx.createdAt).toLocaleDateString()}
      </div>

      {/* Show more toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 text-xs text-muted-foreground"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            Show less <ChevronUp className="ml-1 h-3 w-3" />
          </>
        ) : (
          <>
            Show more <ChevronDown className="ml-1 h-3 w-3" />
          </>
        )}
      </Button>

      {/* Expanded: round */}
      {expanded && (
        <div className="text-sm text-muted-foreground pt-1 border-t border-border">
          <span>Round: </span>
          <span className="font-medium text-foreground">#{tx.round}</span>
        </div>
      )}
    </div>
  );
}
