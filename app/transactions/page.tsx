'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  type: 'CONTRIBUTION' | 'WITHDRAWAL';
  status: string;
  createdAt: string;
  circleName: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchTransactions(token);
  }, []);

  const fetchTransactions = async (token: string) => {
    try {
      const response = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Fetch transactions error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-4">Transaction History</h1>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>A complete log of your contributions and payouts across all circles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center">No transactions found.</TableCell></TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell><Badge variant={tx.type === 'CONTRIBUTION' ? 'outline' : 'default'}>{tx.type}</Badge></TableCell>
                    <TableCell>{tx.amount} XLM</TableCell>
                    <TableCell><span className="text-green-600 font-semibold">{tx.status}</span></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
