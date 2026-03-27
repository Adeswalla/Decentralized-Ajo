'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowLeft } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth-client';

interface Transaction {
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

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTransactions = useCallback(async (p: number, sb: string, o: string) => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/transactions?page=${p}&sortBy=${sb}&order=${o}`);
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactions(data.contributions);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTransactions(page, sortBy, order);
  }, [page, sortBy, order, fetchTransactions]);

  const toggleSort = (col: 'createdAt' | 'amount') => {
    if (sortBy === col) {
      setOrder((o: 'asc' | 'desc') => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-sm text-muted-foreground">{total} total transactions</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No transactions yet</p>
          <p className="text-sm mt-1">Your contributions will appear here once you join a circle.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleSort('createdAt')}>
                      Date <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Circle</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('amount')}>
                      Amount <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: Transaction) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/circles/${tx.circle.id}`} className="hover:underline font-medium">
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
                      {tx.amount.toFixed(2)} XLM
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p: number) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p: number) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
