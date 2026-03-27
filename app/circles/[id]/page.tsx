'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, TrendingUp, Calendar, Send } from 'lucide-react';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/auth-client';

interface Member {
  id: string;
  userId: string;
  rotationOrder: number;
  status: string;
  totalContributed: number;
  totalWithdrawn: number;
  hasReceivedPayout: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface Contribution {
  id: string;
  amount: number;
  round: number;
  status: string;
  createdAt: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

interface Circle {
  id: string;
  name: string;
  description?: string;
  organizerId: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  maxRounds: number;
  currentRound: number;
  status: string;
  members: Member[];
  contributions: Contribution[];
  organizer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function CircleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id as string;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    fetchCircle();
  }, []);

  const fetchCircle = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await authenticatedFetch(`/api/circles/${circleId}`);

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Circle not found');
          router.push('/');
        } else if (response.status === 403) {
          toast.error('You do not have access to this circle');
          router.push('/');
        } else if (response.status === 401) {
          router.push('/auth/login');
        }
        return;
      }

      const data = await response.json();
      setCircle(data.circle);
    } catch (error) {
      console.error('Error fetching circle:', error);
      toast.error('Failed to load circle');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast.error('Please enter a valid contribution amount');
      return;
    }

    setSubmittingContribution(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await authenticatedFetch(`/api/circles/${circleId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(contributionAmount),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        const data = await response.json();
        toast.error(data.error || 'Failed to contribute');
        return;
      }

      toast.success('Contribution recorded successfully!');
      setContributionAmount('');
      fetchCircle();
    } catch (error) {
      console.error('Error contributing:', error);
      toast.error('An error occurred while processing your contribution');
    } finally {
      setSubmittingContribution(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Loading circle...</p>
        </div>
      </main>
    );
  }

  if (!circle) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Circle not found</p>
          <Button asChild className="mt-4">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  const isOrganizer = currentUser?.id === circle.organizerId;
  const isMember = circle.members.some((m) => m.userId === currentUser?.id);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{circle.name}</h1>
              {circle.description && (
                <p className="text-muted-foreground mt-2">{circle.description}</p>
              )}
            </div>
            <div>
              <span className="inline-block px-4 py-2 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                {circle.status}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{circle.members.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Round</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {circle.currentRound} / {circle.maxRounds}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Per Contribution</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{circle.contributionAmount} XLM</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payout Amount</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(circle.contributionAmount * circle.members.length).toFixed(2)} XLM
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {!isMember && !isOrganizer ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground mb-4">
                    You are not a member of this circle yet.
                  </p>
                  <Button asChild>
                    <Link href={`/circles/${circle.id}/join`}>Join This Circle</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Circle Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Organizer</p>
                      <p className="font-semibold">
                        {circle.organizer.firstName} {circle.organizer.lastName || circle.organizer.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contribution Frequency</p>
                      <p className="font-semibold">Every {circle.contributionFrequencyDays} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Rounds</p>
                      <p className="font-semibold">{circle.maxRounds} rounds</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Make Contribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Make a Contribution</CardTitle>
                    <CardDescription>
                      Contribute {circle.contributionAmount} XLM to the circle fund
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleContribute} className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold">Amount (XLM)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={contributionAmount}
                            onChange={(e) => setContributionAmount(e.target.value)}
                            placeholder={circle.contributionAmount.toString()}
                            className="flex-1 px-3 py-2 border border-border rounded-md bg-background"
                          />
                          <Button type="submit" disabled={submittingContribution}>
                            {submittingContribution ? 'Processing...' : 'Contribute'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Circle Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {circle.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-semibold">
                          {member.user.firstName} {member.user.lastName || member.user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Rotation #{member.rotationOrder}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Contributed: </span>
                          <span className="font-semibold">{member.totalContributed} XLM</span>
                        </p>
                        {member.hasReceivedPayout && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Paid Out
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isOrganizer && (
                  <Button asChild className="mt-6 w-full">
                    <Link href={`/circles/${circle.id}/invite`}>Invite Members</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contributions Tab */}
          <TabsContent value="contributions">
            <Card>
              <CardHeader>
                <CardTitle>Contribution History</CardTitle>
              </CardHeader>
              <CardContent>
                {circle.contributions.length === 0 ? (
                  <p className="text-muted-foreground">No contributions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {circle.contributions.map((contribution) => (
                      <div
                        key={contribution.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-semibold">
                            {contribution.user.firstName} {contribution.user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">Round {contribution.round}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{contribution.amount} XLM</p>
                          <p className="text-sm text-muted-foreground">{contribution.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance">
            <Card>
              <CardHeader>
                <CardTitle>Circle Governance</CardTitle>
                <CardDescription>
                  Vote on circle proposals and rule changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Participate in governance by creating proposals and voting on circle decisions:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Circle rule changes</li>
                  <li>Member removal</li>
                  <li>Emergency payouts</li>
                  <li>Circle dissolution</li>
                  <li>Contribution adjustments</li>
                </ul>
                <Button asChild className="w-full mt-4">
                  <Link href={`/circles/${circle.id}/governance`}>
                    View Governance & Proposals
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
