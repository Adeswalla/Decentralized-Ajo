'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { PlusCircle, Search } from 'lucide-react';

import { Dashboard } from '@/components/dashboard';
import DashboardCard from '@/components/DashboardCard';
import DashboardSkeleton from '@/components/dashboard-skeleton';
import { CircleList } from '@/components/dashboard/circle-list';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authenticatedFetch } from '@/lib/auth-client';

const PAGE_SIZE = 9;

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  status: string;
  members: { userId: string }[];
  contributions?: { amount: number }[];
}

interface AjoGroup {
  id: string;
  name: string;
  balance: string | number;
  nextCycle: string;
}

interface UserAjo {
  id: string;
  name: string;
  contractAddress: string;
  contributionAmt: string;
  cycleDuration: number;
  maxMembers: number;
  status: string;
  createdAt: Date;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroups, setActiveGroups] = useState<AjoGroup[]>([]);
  const [userAjos, setUserAjos] = useState<UserAjo[]>([]);
  const [ajosLoading, setAjosLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCircles = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await authenticatedFetch(`/api/circles?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch circles');
      }

      const data = await response.json();
      const nextCircles: Circle[] = data.data || [];

      setCircles(nextCircles);
      setTotalPages(data.meta?.pages || 1);

      const activeCircles = nextCircles.filter(
        (circle) => circle.status?.toUpperCase() === 'ACTIVE',
      );

      setActiveGroups(
        activeCircles.slice(0, 4).map((circle) => {
          const totalBalance =
            circle.contributions?.reduce((sum, contribution) => {
              return sum + contribution.amount;
            }, 0) || 0;

          return {
            id: circle.id,
            name: circle.name,
            balance: `${totalBalance.toLocaleString()} XLM`,
            nextCycle: `Every ${circle.contributionFrequencyDays} days`,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    if (isConnected) {
      fetchCircles();
      return;
    }

    setLoading(false);
  }, [fetchCircles, isConnected]);

  useEffect(() => {
    if (!address || !isConnected) {
      setUserAjos([]);
      return;
    }

    setAjosLoading(true);
    fetch(`/api/user-ajos?address=${address}`)
      .then((response) => response.json())
      .then((data) => {
        setUserAjos(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error fetching user ajos:', error);
      })
      .finally(() => {
        setAjosLoading(false);
      });
  }, [address, isConnected]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <main className="min-h-screen bg-background">
      <Dashboard activeGroups={activeGroups} loading={loading && isConnected} />

      {isConnected && (
        <div className="container mx-auto px-4 py-10">
          <DashboardStats />
        </div>
      )}

      {isConnected && (
        <div className="container mx-auto px-4 pb-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-foreground">My Ajos</h2>
            <Button asChild>
              <Link href="/circles/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Ajo
              </Link>
            </Button>
          </div>

          {ajosLoading ? (
            <DashboardSkeleton />
          ) : userAjos.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-12 text-center">
              <p className="mb-4 text-muted-foreground">
                You haven&apos;t joined any Ajo groups yet.
              </p>
              <Button asChild variant="outline">
                <Link href="/circles/join">Browse Ajos</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {userAjos.map((ajo) => (
                <DashboardCard key={ajo.id} ajo={ajo} />
              ))}
            </div>
          )}
        </div>
      )}

      {!isConnected && (
        <div className="container mx-auto px-4 py-16">
          <div className="rounded-lg border-2 border-dashed p-12 text-center">
            <h3 className="mb-4 text-2xl font-bold text-foreground">
              Connect Your Wallet
            </h3>
            <p className="text-muted-foreground">
              Connect your wallet to view and manage your Ajo groups.
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12">
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-2xl font-bold text-foreground">
              Explore More Circles
            </h2>

            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search circles..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full pl-10 sm:w-64"
                />
              </div>

              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="border border-border/50 bg-card">
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="ACTIVE">Active</TabsTrigger>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <CircleList circles={circles} loading={loading} />

          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((page) => Math.max(1, page - 1));
                      }}
                      aria-disabled={currentPage === 1}
                      className={
                        currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                      }
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                    const page = index + 1;

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === page}
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((page) => Math.min(totalPages, page + 1));
                      }}
                      aria-disabled={currentPage === totalPages}
                      className={
                        currentPage === totalPages
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
