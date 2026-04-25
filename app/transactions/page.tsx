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

  // Filter states
  const [circleId, setCircleId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Cursor states
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const fetchTransactions = useCallback(
    async (p: number, sb: string, o: string, cId: string, t: string, fDate: string, tDate: string, cur: string | null) => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      setLoading(true);
      try {
        let url = `/api/transactions?limit=20&sortBy=${sb}&order=${o}`;
        if (cur) url += `&cursor=${cur}`;
        else url += `&page=${p}`;
        if (cId) url += `&circleId=${cId}`;
        if (t) url += `&type=${t}`;
        if (fDate) url += `&from=${fDate}`;
        if (tDate) url += `&to=${tDate}`;

        const res = await authenticatedFetch(url);
        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTransactions(data.contributions);
        setTotal(data.total);
        setNextCursor(data.nextCursor || null);
      } catch {
        // silent — keep previous data on transient errors
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchTransactions(page, sortBy, order, circleId, type, from, to, currentCursor);
  }, [page, sortBy, order, circleId, type, from, to, currentCursor, fetchTransactions]);

  const toggleSort = (col: 'createdAt' | 'amount') => {
    if (sortBy === col) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setOrder('desc');
    }
    setPage(1);
    setCurrentCursor(null);
    setCursorHistory([]);
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory((prev) => [...prev, currentCursor || '']);
      setCurrentCursor(nextCursor);
      setPage((p) => p + 1);
    } else {
      setPage((p) => p + 1);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const newHistory = [...cursorHistory];
      const prevCursor = newHistory.pop() || null;
      setCursorHistory(newHistory);
      setCurrentCursor(prevCursor === '' ? null : prevCursor);
    }
    setPage((p) => Math.max(1, p - 1));
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Filter by Circle ID" 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={circleId}
          onChange={(e) => { setCircleId(e.target.value); setPage(1); setCurrentCursor(null); setCursorHistory([]); }}
        />
        <select 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); setCurrentCursor(null); setCursorHistory([]); }}
        >
          <option value="">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <input 
          type="date" 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); setCurrentCursor(null); setCursorHistory([]); }}
          title="From Date"
        />
        <input 
          type="date" 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); setCurrentCursor(null); setCursorHistory([]); }}
          title="To Date"
        />
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
                  onClick={handlePrevPage}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                  disabled={page === totalPages && !nextCursor}
                  onClick={handleNextPage}
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
