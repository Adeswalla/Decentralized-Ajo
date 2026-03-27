'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Vote,
  ShieldAlert,
  Users,
  AlertTriangle,
} from 'lucide-react';

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

interface ProposalCardProps {
  proposal: Proposal;
  onVote: (proposalId: string, voteChoice: string) => Promise<void>;
  isWalletConnected: boolean;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  ACTIVE: { variant: 'default', label: 'Active' },
  PASSED: { variant: 'secondary', label: 'Passed' },
  REJECTED: { variant: 'destructive', label: 'Rejected' },
  EXECUTED: { variant: 'outline', label: 'Executed' },
  PENDING: { variant: 'outline', label: 'Pending' },
};

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  RULE_CHANGE: 'Rule Change',
  MEMBER_REMOVAL: 'Member Removal',
  EMERGENCY_PAYOUT: 'Emergency Payout',
  CIRCLE_DISSOLUTION: 'Circle Dissolution',
  CONTRIBUTION_ADJUSTMENT: 'Contribution Adjustment',
};

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Voting ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeLeft(`${minutes}m remaining`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { timeLeft, isExpired };
}

export function ProposalCard({ proposal, onVote, isWalletConnected }: ProposalCardProps) {
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { timeLeft, isExpired } = useCountdown(proposal.votingEndDate);

  const statusConfig = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.PENDING;
  const quorumMet = proposal.quorumPercentage >= proposal.requiredQuorum;
  const canVote = proposal.status === 'ACTIVE' && !proposal.userVote && !isExpired && isWalletConnected;

  const handleSubmitVote = async () => {
    if (!selectedVote) return;
    setIsSubmitting(true);
    try {
      await onVote(proposal.id, selectedVote);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalYesNo = proposal.yesVotes + proposal.noVotes;
  const yesPercent = totalYesNo > 0 ? Math.round((proposal.yesVotes / totalYesNo) * 100) : 0;
  const noPercent = totalYesNo > 0 ? Math.round((proposal.noVotes / totalYesNo) * 100) : 0;

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-lg border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg leading-tight">{proposal.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusConfig.variant} className="text-[11px]">
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                {PROPOSAL_TYPE_LABELS[proposal.proposalType] || proposal.proposalType}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3">{proposal.description}</p>

        {/* Countdown */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={isExpired ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            {timeLeft}
          </span>
        </div>

        {/* Quorum Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Quorum ({proposal.requiredQuorum}%)
            </span>
            <span className={quorumMet ? 'text-primary font-semibold' : 'text-muted-foreground'}>
              {proposal.quorumPercentage}% reached
            </span>
          </div>
          <Progress value={Math.min(proposal.quorumPercentage, 100)} className="h-2" />
          {quorumMet && (
            <p className="text-[11px] text-primary font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Quorum met
            </p>
          )}
        </div>

        {/* Vote Tally */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-md bg-primary/5 border border-primary/10">
            <CheckCircle className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs text-muted-foreground">Yes</span>
            <span className="text-sm font-bold text-foreground">{proposal.yesVotes}</span>
            {totalYesNo > 0 && (
              <span className="text-[10px] text-muted-foreground">{yesPercent}%</span>
            )}
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-destructive/5 border border-destructive/10">
            <XCircle className="h-4 w-4 text-destructive mb-1" />
            <span className="text-xs text-muted-foreground">No</span>
            <span className="text-sm font-bold text-foreground">{proposal.noVotes}</span>
            {totalYesNo > 0 && (
              <span className="text-[10px] text-muted-foreground">{noPercent}%</span>
            )}
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-muted/50 border border-muted">
            <MinusCircle className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Abstain</span>
            <span className="text-sm font-bold text-foreground">{proposal.abstainVotes}</span>
          </div>
        </div>

        {/* Already Voted Indicator */}
        {proposal.userVote && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
            <Vote className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              You voted: <span className="text-primary">{proposal.userVote}</span>
            </span>
          </div>
        )}

        {/* Wallet not connected warning */}
        {!isWalletConnected && proposal.status === 'ACTIVE' && !proposal.userVote && !isExpired && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-secondary/20 border border-secondary/30">
            <AlertTriangle className="h-4 w-4 text-secondary-foreground" />
            <span className="text-xs text-secondary-foreground">Connect wallet to vote</span>
          </div>
        )}
      </CardContent>

      {/* Voting Form */}
      {canVote && (
        <CardFooter className="flex flex-col gap-3 border-t border-border/50 bg-muted/20 pt-4">
          <RadioGroup
            value={selectedVote}
            onValueChange={setSelectedVote}
            className="flex gap-4 w-full justify-center"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="YES" id={`yes-${proposal.id}`} />
              <Label htmlFor={`yes-${proposal.id}`} className="text-sm cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="NO" id={`no-${proposal.id}`} />
              <Label htmlFor={`no-${proposal.id}`} className="text-sm cursor-pointer">No</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="ABSTAIN" id={`abstain-${proposal.id}`} />
              <Label htmlFor={`abstain-${proposal.id}`} className="text-sm cursor-pointer">Abstain</Label>
            </div>
          </RadioGroup>
          <Button
            onClick={handleSubmitVote}
            disabled={!selectedVote || isSubmitting}
            className="w-full"
            size="sm"
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Cast Vote
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
