'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShieldCheck, Filter } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { authenticatedFetch } from '@/lib/auth-client';
import { useWallet } from '@/lib/wallet-context';
import { ProposalCard } from '@/components/governance/proposal-card';
import { CreateProposalDialog } from '@/components/governance/create-proposal-dialog';
import { GovernanceSkeleton } from '@/components/skeletons';

type StatusFilter = 'ALL' | 'ACTIVE' | 'PASSED' | 'REJECTED';

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposalType: string;
  status: string;
  votingStartDate: string;
  votingEndDate: string;
  requiredQuorum: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  totalVotes: number;
  totalMembers: number;
  userVote: string | null;
  quorumPercentage: number;
}

const fetcher = async (url: string) => {
  const res = await authenticatedFetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    if (res.status === 403) throw new Error('Forbidden');
    throw new Error('Failed to fetch');
  }
  return res.json();
};

export default function GovernancePage() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id as string;
  const { isConnected } = useWallet();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, mutate, error, isLoading } = useSWR(
    circleId ? `/api/circles/${circleId}/governance` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const proposals = useMemo(() => data?.proposals || [], [data]);

  useEffect(() => {
    if (error) {
      if (error.message === 'Unauthorized') {
        router.push('/auth/login');
      } else if (error.message === 'Forbidden') {
        toast.error('You do not have access to this circle');
        router.push('/');
      } else {
        toast.error('Failed to load proposals');
      }
    }
  }, [error, router]);

  const handleCreateProposal = async (data: {
    title: string;
    description: string;
    proposalType: string;
    votingEndDate: string;
    requiredQuorum: number;
  }) => {
    try {
      const response = await authenticatedFetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create proposal');
      }

      toast.success('Proposal created successfully!');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create proposal');
    }
  };

  const handleVote = async (proposalId: string, voteChoice: string) => {
    const originalProposals = proposals;

    // 1. Optimistic update
    const updatedProposals = proposals.map((p: Proposal) => {
      if (p.id === proposalId) {
        const isNewVote = !p.userVote;
        const yesChange = voteChoice === 'YES' ? 1 : (p.userVote === 'YES' ? -1 : 0);
        const noChange = voteChoice === 'NO' ? 1 : (p.userVote === 'NO' ? -1 : 0);
        const abstainChange = voteChoice === 'ABSTAIN' ? 1 : (p.userVote === 'ABSTAIN' ? -1 : 0);
        const totalChange = isNewVote ? 1 : 0;

        const newTotalVotes = p.totalVotes + totalChange;

        return {
          ...p,
          userVote: voteChoice,
          yesVotes: p.yesVotes + yesChange,
          noVotes: p.noVotes + noChange,
          abstainVotes: p.abstainVotes + abstainChange,
          totalVotes: newTotalVotes,
          quorumPercentage: p.totalMembers > 0
            ? Math.round((newTotalVotes / p.totalMembers) * 100)
            : 0,
        };
      }
      return p;
    });

    // Apply optimistic update
    mutate({ ...data, proposals: updatedProposals }, false);

    try {
      // 2. Server request
      const response = await authenticatedFetch(
        `/api/circles/${circleId}/governance/${proposalId}/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voteChoice }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cast vote');
      }

      // 3. Server confirms - revalidate
      await mutate();
      toast.success('Vote cast successfully!');
    } catch (err: any) {
      // 4. Rollback on error
      mutate({ ...data, proposals: originalProposals }, false);
      toast.error(err.message || 'Failed to cast vote');
    }
  };

  const filteredProposals = proposals.filter((p: Proposal) =>
    statusFilter === 'ALL' ? true : p.status === statusFilter,
  );

  const activeCount = proposals.filter((p: Proposal) => p.status === 'ACTIVE').length;


  const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PASSED', label: 'Passed' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  if (isLoading) {
    return <GovernanceSkeleton />;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link
            href={`/circles/${circleId}`}
            className="flex items-center text-primary hover:underline mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Circle
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Governance</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {activeCount > 0
                    ? `${activeCount} active proposal${activeCount !== 1 ? 's' : ''}`
                    : 'No active proposals'}
                </p>
              </div>
            </div>
            <CreateProposalDialog onSubmit={handleCreateProposal} />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="text-xs"
            >
              {filter.label}
              {filter.value !== 'ALL' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                  {proposals.filter((p: Proposal) =>
                    filter.value === 'ALL' ? true : p.status === filter.value,
                  ).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Proposals Grid */}
        {filteredProposals.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {statusFilter === 'ALL' ? 'No proposals yet' : `No ${statusFilter.toLowerCase()} proposals`}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {statusFilter === 'ALL'
                  ? 'Create the first governance proposal to get started. Circle members can then vote on it.'
                  : `There are no proposals with status "${statusFilter}" at the moment.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProposals.map((proposal: Proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onVote={handleVote}
                isWalletConnected={isConnected}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
