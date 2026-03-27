'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShieldCheck, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/auth-client';
import { useWallet } from '@/lib/wallet-context';
import { ProposalCard } from '@/components/governance/proposal-card';
import { CreateProposalDialog } from '@/components/governance/create-proposal-dialog';

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

export default function GovernancePage() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id as string;
  const { isConnected } = useWallet();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchProposals = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await authenticatedFetch(`/api/circles/${circleId}/governance`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have access to this circle');
          router.push('/');
          return;
        }
        toast.error('Failed to load proposals');
        return;
      }

      const data = await response.json();
      setProposals(data.proposals);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [circleId, router]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleCreateProposal = async (data: {
    title: string;
    description: string;
    proposalType: string;
    votingEndDate: string;
    requiredQuorum: number;
  }) => {
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
    fetchProposals();
  };

  const handleVote = async (proposalId: string, voteChoice: string) => {
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
      toast.error(errorData.error || 'Failed to cast vote');
      return;
    }

    toast.success('Vote cast successfully!');
    fetchProposals();
  };

  const filteredProposals = proposals.filter((p) =>
    statusFilter === 'ALL' ? true : p.status === statusFilter,
  );

  const activeCount = proposals.filter((p) => p.status === 'ACTIVE').length;

  const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PASSED', label: 'Passed' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Loading governance proposals...</p>
        </div>
      </main>
    );
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
                  {proposals.filter((p) =>
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
            {filteredProposals.map((proposal) => (
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
