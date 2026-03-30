'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatDistanceToNow, addDays } from 'date-fns';

interface Circle {
  id: string;
  name: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  currentRound: number;
  maxRounds: number;
  createdAt: string;
  members: { userId: string }[];
}

const fetcher = async (url: string) => {
  const res = await authenticatedFetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

function getNextCycleDate(circle: Circle): Date {
  const created = new Date(circle.createdAt);
  const daysSinceStart = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  const daysUntilNext =
    circle.contributionFrequencyDays - (daysSinceStart % circle.contributionFrequencyDays);
  return addDays(new Date(), daysUntilNext);
}

export function UpcomingCycles() {
  const { data, isLoading } = useSWR<{ data: Circle[] }>(
    '/api/circles?status=ACTIVE&limit=5&sortBy=newest',
    fetcher,
    { refreshInterval: 60000 }
  );

  const circles = data?.data ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Upcoming Payment Cycles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (circles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Upcoming Payment Cycles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active circles with upcoming cycles.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by soonest next cycle
  const sorted = [...circles].sort(
    (a, b) => getNextCycleDate(a).getTime() - getNextCycleDate(b).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Upcoming Payment Cycles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((circle) => {
          const nextDate = getNextCycleDate(circle);
          const isUrgent = nextDate.getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000;
          const payout = circle.contributionAmount * circle.members.length;

          return (
            <Link
              key={circle.id}
              href={`/circles/${circle.id}`}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-full ${isUrgent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{circle.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Round {circle.currentRound}/{circle.maxRounds} · {payout.toFixed(2)} XLM payout
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-xs font-medium ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formatDistanceToNow(nextDate, { addSuffix: true })}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
