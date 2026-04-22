'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatAmount } from '@/lib/utils';

interface CirclePreview {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  maxRounds: number;
  currentRound: number;
  status: string;
  organizer: { firstName?: string; lastName?: string; email: string };
  members: { id: string }[];
}

function JoinCircleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [circleIdInput, setCircleIdInput] = useState(searchParams.get('id') ?? '');
  const [preview, setPreview] = useState<CirclePreview | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const joinRequestInFlightRef = useRef(false);

  // Auto-preview when ?id= is present in URL
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) fetchPreview(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreview = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;

    setPreviewError('');
    setPreview(null);
    setAlreadyMember(false);
    setPreviewing(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await authenticatedFetch(`/api/circles/${trimmed}/join`);
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setPreviewError(data.error ?? 'Circle not found');
        return;
      }

      setPreview(data.circle);
      setAlreadyMember(data.alreadyMember);
    } catch {
      setPreviewError('Failed to fetch circle details. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPreview(circleIdInput);
  };

  const handleJoin = async () => {
    if (!preview || joinRequestInFlightRef.current) return;

    joinRequestInFlightRef.current = true;
    setJoining(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await authenticatedFetch(`/api/circles/${preview.id}/join`, {
        method: 'POST',
      });
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to join circle');
        return;
      }

      toast.success(`You've joined ${preview.name}`);
      router.push(`/circles/${preview.id}`);
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      joinRequestInFlightRef.current = false;
      setJoining(false);
    }
  };

  const organizerName = preview
    ? [preview.organizer.firstName, preview.organizer.lastName].filter(Boolean).join(' ') ||
      preview.organizer.email
    : '';

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Join a Circle</h1>
          <p className="text-muted-foreground mt-1">
            Enter a Circle ID or use an invite link to preview and join.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-lg">
        {/* Lookup form */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Circle ID</CardTitle>
            <CardDescription>Paste the Circle ID or use an invite link with ?id=</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="circle-id" className="sr-only">
                  Circle ID
                </Label>
                <Input
                  id="circle-id"
                  placeholder="e.g. clx1abc2def3..."
                  value={circleIdInput}
                  onChange={(e) => {
                    setCircleIdInput(e.target.value);
                    setPreview(null);
                    setPreviewError('');
                  }}
                  disabled={previewing}
                />
              </div>
              <Button type="submit" disabled={!circleIdInput.trim()} isLoading={previewing}>
                Look Up
              </Button>
            </form>

            {previewError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {previewError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preview card */}
        {preview && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{preview.name}</CardTitle>
                  {preview.description && (
                    <CardDescription className="mt-1">{preview.description}</CardDescription>
                  )}
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary shrink-0 ml-4">
                  {preview.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{formatAmount(preview.contributionAmount)} XLM</p>
                  <p className="text-xs text-muted-foreground">Per round</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{preview.members.length}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">
                    {preview.currentRound}/{preview.maxRounds}
                  </p>
                  <p className="text-xs text-muted-foreground">Rounds</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Organizer: <span className="text-foreground font-medium">{organizerName}</span>
                </p>
                <p>
                  Frequency:{' '}
                  <span className="text-foreground font-medium">
                    Every {preview.contributionFrequencyDays} day
                    {preview.contributionFrequencyDays !== 1 ? 's' : ''}
                  </span>
                </p>
              </div>

              {alreadyMember ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You are already a member of this circle.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/circles/${preview.id}`}>View Circle</Link>
                  </Button>
                </div>
              ) : preview.status !== 'ACTIVE' && preview.status !== 'PENDING' ? (
                <p className="text-sm text-destructive" role="alert">
                  This circle is not accepting new members.
                </p>
              ) : (
                <Button className="w-full" onClick={handleJoin} disabled={joining} isLoading={joining}>
                  Confirm Join
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function JoinCirclePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    }>
      <JoinCircleContent />
    </Suspense>
  );
}
