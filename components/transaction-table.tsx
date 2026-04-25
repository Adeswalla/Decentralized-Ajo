'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatAmount } from '@/lib/utils';

export interface Transaction {
  id: string;
  amount: number;
  round: number;
  status: string;
  createdAt: string;
  circle: { id: string; name: string };
  /** On-chain Stellar transaction hash (64-char hex). Optional — may be absent for legacy rows. */
  txHash?: string;
  /** On-chain Soroban contract ID. Optional. */
  contractId?: string;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  COMPLETED: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};

interface TransactionTableProps {
  transactions: Transaction[];
  onSort?: (col: 'createdAt' | 'amount') => void;
  sortBy?: 'createdAt' | 'amount';
  order?: 'asc' | 'desc';
}

export function TransactionTable({ transactions, onSort, sortBy, order }: TransactionTableProps) {
  return (
    <div className="w-full">
      {/* Desktop View */}
      <div className="hidden md:block w-full overflow-x-auto rounded-md border">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => onSort?.('createdAt')}
                >
                  Date {sortBy === 'createdAt' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                </Button>
              </TableHead>
              <TableHead>Circle</TableHead>
              <TableHead>Round</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSort?.('amount')}
                >
                  Amount {sortBy === 'amount' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                </Button>
              </TableHead>
              <TableHead>Tx Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Link href={`/circles/${tx.circle.id}`} className="hover:underline font-medium text-primary">
                    {tx.circle.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">#{tx.round}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[tx.status] ?? 'secondary'}>
                    {tx.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatAmount(tx.amount)} XLM
                </TableCell>
                <TableCell>
                  {tx.txHash ? (
                    <ExplorerLink
                      hash={tx.txHash}
                      type="tx"
                      showLab
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View: stacked cards */}
      <div className="space-y-3 md:hidden">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex flex-col p-3 border rounded shadow-sm gap-1.5"
          >
            <span className="text-sm text-muted-foreground md:text-black">
              {new Date(tx.createdAt).toLocaleDateString()}
            </span>
            <span className="font-semibold">{formatAmount(tx.amount)} XLM</span>
            <span className="text-blue-600">
              <Link href={`/circles/${tx.circle.id}`} className="hover:underline">
                {tx.circle.name}
              </Link>
            </span>
            <span className="">
              <Badge variant={statusVariant[tx.status] ?? 'secondary'} className="h-fit py-0.5 px-2">
                {tx.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-blue-600">
                <Link href={`/circles/${tx.circle.id}`} className="hover:underline">
                  {tx.circle.name}
                </Link>
              </span>
              <span className="font-semibold">{tx.amount.toFixed(2)} XLM</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Tx Hash</span>
              {tx.txHash ? (
                <ExplorerLink
                  hash={tx.txHash}
                  type="tx"
                  showLab
                  truncateChars={5}
                />
              ) : (
                <span className="text-xs text-muted-foreground font-mono" title={tx.id}>
                  {tx.id.slice(0, 10)}…
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionCard({ transaction }: { transaction: Transaction }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            {new Date(transaction.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="text-xl font-bold tracking-tight">
            {formatAmount(transaction.amount)} <span className="text-sm font-normal text-muted-foreground">XLM</span>
          </p>
        </div>
        <Badge variant={statusVariant[transaction.status] ?? 'secondary'} className="h-fit py-0.5 px-2">
          {transaction.status}
        </Badge>
      </div>

      {isExpanded ? (
        <div className="pt-2 border-t text-sm space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Circle</span>
            <Link href={`/circles/${transaction.circle.id}`} className="font-medium hover:underline text-primary">
              {transaction.circle.name}
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Round</span>
            <span className="font-medium">#{transaction.round}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground whitespace-nowrap">Tx Hash</span>
            {transaction.txHash ? (
              <ExplorerLink
                hash={transaction.txHash}
                type="tx"
                showLab
                truncateChars={5}
              />
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]" title={transaction.id}>
                {transaction.id}
              </span>
            )}
          </div>
          {transaction.contractId && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground whitespace-nowrap">Contract</span>
              <ExplorerLink
                hash={transaction.contractId}
                type="contract"
                showLab
                truncateChars={5}
              />
            </div>
          )}
        </div>
      ) : null}

      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-foreground min-h-[44px] flex items-center justify-center gap-1 group transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>Hide Details <ChevronUp className="h-4 w-4 transition-transform" /></>
        ) : (
          <>View Details <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" /></>
        )}
      </Button>
    </div>
  );
}
