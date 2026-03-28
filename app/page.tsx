'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, PlusCircle, Wallet, TrendingUp, CircleDot, ArrowRight, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CircleList } from '@/components/dashboard/circle-list';
import { authenticatedFetch } from '@/lib/auth-client';
import { CircleList } from '@/components/dashboard/circle-list';

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  status: string;
  members: { userId: string }[];
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  // Filter and Sort State - Synced with URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [durationFilter, setDurationFilter] = useState(searchParams.get('duration') || 'ALL');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'newest');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL when filters change
  const updateURLParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (durationFilter !== 'ALL') params.set('duration', durationFilter);
    if (sortBy !== 'newest') params.set('sortBy', sortBy);
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, statusFilter, durationFilter, sortBy, router]);

  useEffect(() => {
    updateURLParams();
  }, [updateURLParams]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setDurationFilter('ALL');
    setSortBy('newest');
  };

  // Remove single filter
  const removeFilter = (filterType: string) => {
    if (filterType === 'status') setStatusFilter('ALL');
    if (filterType === 'duration') setDurationFilter('ALL');
    if (filterType === 'sort') setSortBy('newest');
    if (filterType === 'search') setSearchQuery('');
  };

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
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (durationFilter !== 'ALL') params.set('duration', durationFilter);
      if (sortBy) params.set('sortBy', sortBy);
      
      const response = await authenticatedFetch(`/api/circles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCircles();
    }
  }, [debouncedSearchQuery, statusFilter, durationFilter, sortBy, isAuthenticated]);

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Active filters count
  const activeFiltersCount = [
    statusFilter !== 'ALL',
    durationFilter !== 'ALL',
    sortBy !== 'newest',
    searchQuery !== ''
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
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

        {/* Filter Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Your Ajo Circles</h2>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search circles..."
                  className="pl-10 bg-card border-border/50 focus:border-primary/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList className="bg-card border border-border/50">
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="ACTIVE">Active</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="COMPLETED">Done</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Duration Filter Dropdown */}
              <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger className="w-[140px] bg-card border-border/50">
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Durations</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Dropdown */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] bg-card border-border/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="size_desc">Size: High to Low</SelectItem>
                  <SelectItem value="size_asc">Size: Low to High</SelectItem>
                  <SelectItem value="name_asc">Name: A to Z</SelectItem>
                  <SelectItem value="name_desc">Name: Z to A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X className="h-3 w-3 cursor-pointer ml-1" onClick={() => removeFilter('search')} />
                </Badge>
              )}
              
              {statusFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter}
                  <X className="h-3 w-3 cursor-pointer ml-1" onClick={() => removeFilter('status')} />
                </Badge>
              )}
              
              {durationFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1">
                  Duration: {durationFilter}
                  <X className="h-3 w-3 cursor-pointer ml-1" onClick={() => removeFilter('duration')} />
                </Badge>
              )}
              
              {sortBy !== 'newest' && (
                <Badge variant="secondary" className="gap-1">
                  Sort: {sortBy === 'size_desc' ? 'Size: High to Low' : 
                         sortBy === 'size_asc' ? 'Size: Low to High' :
                         sortBy === 'name_asc' ? 'Name: A to Z' :
                         sortBy === 'name_desc' ? 'Name: Z to A' : sortBy}
                  <X className="h-3 w-3 cursor-pointer ml-1" onClick={() => removeFilter('sort')} />
                </Badge>
              )}
              
              {activeFiltersCount > 1 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7">
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>

        <CircleList circles={circles} loading={loading} />
      </div>
    </main>
  );
}

// Landing Page Component
function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Stellar Ajo</span>
          </div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <Button variant="outline" onClick={() => router.push('/auth/login')}>
              Sign In
            </Button>
            <Button onClick={() => router.push('/auth/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
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
            <Button size="lg" variant="outline" onClick={() => router.push('/auth/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
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
                <p className="text-muted-foreground">
                  Your funds are managed by smart contracts on the Stellar blockchain. No intermediaries, full transparency.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Community Trust</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Participate in governance decisions. Vote on circle rules and payout schedules together.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Smart Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Automated contributions, secure payouts, and penalty-free emergency withdrawals.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to start saving?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of members building financial security through community.
          </p>
          <Button size="lg" onClick={() => router.push('/auth/register')}>
            Create Your First Circle
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2026 Stellar Ajo. Built for communities, powered by Stellar.</p>
        </div>
      </footer>
    </main>
  );
}