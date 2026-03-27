'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Activity, Wallet, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalCircles: number;
  activeCircles: number;
  totalContributed: number;
  totalWithdrawn: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchStats(token);
  }, []);

  const fetchStats = async (token: string) => {
    try {
      const response = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Your Dashboard</h1>
          <p className="text-muted-foreground mt-2">Oversee your savings performance across all Ajo circles.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/circles">Browse Circles</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard title="Total Circles" value={stats?.totalCircles || 0} icon={Users} color="text-blue-500" />
        <StatCard title="Active Rounds" value={stats?.activeCircles || 0} icon={Activity} color="text-green-500" />
        <StatCard title="Total Savings" value={`${stats?.totalContributed || 0} XLM`} icon={Wallet} color="text-purple-500" />
        <StatCard title="Withdrawals" value={`${stats?.totalWithdrawn || 0} XLM`} icon={TrendingUp} color="text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>View your latest contributions and payouts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground text-center py-10 border-2 border-dashed rounded-lg">No recent transactions to display.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
            <CardDescription>Upcoming votes in your circles.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground">No active proposals in your joined circles.</p>
             <Button variant="link" className="mt-4 p-0">View Governance Panel <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
