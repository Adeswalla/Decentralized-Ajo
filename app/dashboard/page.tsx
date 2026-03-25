'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Search } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth-client';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { CircleList } from '@/components/dashboard/circle-list';

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  status: string;
  members: { userId: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  
  // Search and Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserName(userData.firstName || userData.email);
    }

    fetchCircles();
  }, [router]);

  const fetchCircles = async () => {
    try {
      const response = await authenticatedFetch('/api/circles');
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      } else if (response.status === 401) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter circles based on search and status
  const filteredCircles = circles.filter((circle) => {
    const matchesSearch = circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         circle.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || circle.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <div className="mb-12">
          <DashboardStats />
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
                  className="pl-10 bg-card border-border/50 focus:border-primary/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList className="bg-card border border-border/50">
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
