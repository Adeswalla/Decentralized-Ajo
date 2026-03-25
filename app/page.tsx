'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, PlusCircle, Wallet, TrendingUp, CircleDot, ArrowRight, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { authenticatedFetch } from '@/lib/auth-client';

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  status: string;
  members: { userId: string }[];
}

function CircleList({ circles, loading }: { circles: Circle[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading circles...</p>
      </div>
    );
  }

  if (circles.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <CircleDot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No circles yet</h3>
          <p className="text-muted-foreground mb-6">Start your first savings circle and invite friends!</p>
          <Button asChild>
            <Link href="/circles/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Your First Circle
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {circles.map((circle) => (
        <Link key={circle.id} href={`/circles/${circle.id}`}>
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">{circle.name}</CardTitle>
              <CardDescription>{circle.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{circle.members?.length || 0}</span> members
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{circle.contributionAmount} XLM</span> per contribution
                </p>
                <p className="text-sm">
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {circle.status}
                  </span>
                </p>
              </div>
              <div className="flex items-center text-primary font-semibold text-sm pt-2">
                View Details <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    setIsAuthenticated(true);
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserName(userData.firstName || userData.email);
    }

    fetchCircles();
  }, []);

  const fetchCircles = async () => {
    try {
      const response = await authenticatedFetch('/api/circles');
      if (response.ok) {
        const data = await response.json();
        setCircles(data.circles || []);
      }
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCircles = circles.filter((c) => {
    const matchesSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome back, {userName}!</h1>
              <p className="text-muted-foreground mt-1">Manage your Ajo savings circles</p>
            </div>
            <Button asChild>
              <Link href="/circles/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Circle
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Circles</CardTitle>
              <CircleDot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{circles.length}</div>
              <p className="text-xs text-muted-foreground">Savings circles joined</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {circles.reduce((acc, circle) => acc + (circle.members?.length || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">Across all circles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pooled</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {circles.reduce((acc, c) => acc + (c.contributionAmount || 0), 0).toFixed(2)} XLM
              </div>
              <p className="text-xs text-muted-foreground">Combined contributions</p>
            </CardContent>
          </Card>
        </div>

        {/* Circles List Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Your Ajo Circles</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search circles..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="ACTIVE">Active</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="COMPLETED">Done</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <CircleList circles={filteredCircles} loading={loading} />
        </div>
      </div>
    </main>
  );
}

function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Stellar Ajo</span>
          </div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <Button variant="outline" onClick={() => router.push('/auth/login')}>Sign In</Button>
            <Button onClick={() => router.push('/auth/register')}>Get Started</Button>
          </div>
        </div>
      </header>

      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Decentralized Savings for Your Community
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join a modern Ajo circle powered by Stellar blockchain. Save together, grow together, with full transparency and security.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => router.push('/auth/register')}>
              Start Saving <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/auth/login')}>Sign In</Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-card">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Stellar Ajo?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Wallet className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Full Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Your funds are managed by smart contracts on the Stellar blockchain. No intermediaries, full transparency.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Community Trust</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Participate in governance decisions. Vote on circle rules and payout schedules together.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Smart Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Automated contributions, secure payouts, and penalty-free emergency withdrawals.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to start saving?</h2>
          <p className="text-lg text-muted-foreground mb-8">Join thousands of members building financial security through community.</p>
          <Button size="lg" onClick={() => router.push('/auth/register')}>Create Your First Circle</Button>
        </div>
      </section>

      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2026 Stellar Ajo. Built for communities, powered by Stellar.</p>
        </div>
      </footer>
    </main>
  );
}
