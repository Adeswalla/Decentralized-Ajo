'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface CreateProposalDialogProps {
  onSubmit: (data: {
    title: string;
    description: string;
    proposalType: string;
    votingEndDate: string;
    requiredQuorum: number;
  }) => Promise<void>;
}

const PROPOSAL_TYPES = [
  { value: 'RULE_CHANGE', label: 'Rule Change' },
  { value: 'MEMBER_REMOVAL', label: 'Member Removal' },
  { value: 'EMERGENCY_PAYOUT', label: 'Emergency Payout' },
  { value: 'CIRCLE_DISSOLUTION', label: 'Circle Dissolution' },
  { value: 'CONTRIBUTION_ADJUSTMENT', label: 'Contribution Adjustment' },
];

export function CreateProposalDialog({ onSubmit }: CreateProposalDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposalType, setProposalType] = useState('RULE_CHANGE');
  const [votingEndDate, setVotingEndDate] = useState('');
  const [requiredQuorum, setRequiredQuorum] = useState(50);
  const [error, setError] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProposalType('RULE_CHANGE');
    setVotingEndDate('');
    setRequiredQuorum(50);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (!description.trim() || description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }
    if (!votingEndDate) {
      setError('Please set a voting end date');
      return;
    }
    if (new Date(votingEndDate) <= new Date()) {
      setError('Voting end date must be in the future');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        proposalType,
        votingEndDate: new Date(votingEndDate).toISOString(),
        requiredQuorum,
      });
      resetForm();
      setOpen(false);
    } catch {
      setError('Failed to create proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimum date is tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Governance Proposal</DialogTitle>
          <DialogDescription>
            Submit a new proposal for circle members to vote on.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="proposal-title">Title</Label>
            <input
              id="proposal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title..."
              maxLength={100}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="proposal-description">Description</Label>
            <textarea
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the proposal in detail..."
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground text-right">{description.length}/2000</p>
          </div>

          {/* Proposal Type */}
          <div className="space-y-2">
            <Label htmlFor="proposal-type">Proposal Type</Label>
            <select
              id="proposal-type"
              value={proposalType}
              onChange={(e) => setProposalType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PROPOSAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voting End Date */}
          <div className="space-y-2">
            <Label htmlFor="voting-end-date">Voting End Date</Label>
            <input
              id="voting-end-date"
              type="date"
              value={votingEndDate}
              onChange={(e) => setVotingEndDate(e.target.value)}
              min={minDateStr}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Required Quorum */}
          <div className="space-y-2">
            <Label htmlFor="required-quorum">Required Quorum (%)</Label>
            <div className="flex items-center gap-3">
              <input
                id="required-quorum"
                type="range"
                min={1}
                max={100}
                value={requiredQuorum}
                onChange={(e) => setRequiredQuorum(parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-medium w-12 text-right">{requiredQuorum}%</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
