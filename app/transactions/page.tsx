'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TransactionTable, type Transaction } from '@/components/transaction-table';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatAmount } from '@/lib/utils';

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTransactions = useCallback(
    async (p: number, sb: string, o: string) => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      setLoading(true);
      try {
        const res = await authenticatedFetch(
          `/api/transactions?page=${p}&sortBy=${sb}&order=${o}`
        );
        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTransactions(data.contributions);
        setTotal(data.total);
      } catch {
        // silent — keep previous data on transient errors
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchTransactions(page, sortBy, order);
  }, [page, sortBy, order, fetchTransactions]);

  const toggleSort = (col: 'createdAt' | 'amount') => {
    if (sortBy === col) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-sm text-muted-foreground">{total} total transactions</p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : transactions.length === 0 ? (
        <NoTransactionsEmpty />
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
                      {formatAmount(tx.amount)} XLM
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
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
