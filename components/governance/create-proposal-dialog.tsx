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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProposalType('RULE_CHANGE');
    setVotingEndDate('');
    setRequiredQuorum(50);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    if (!description.trim() || description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    if (!votingEndDate) {
      newErrors.votingEndDate = 'Please set a voting end date';
    } else if (new Date(votingEndDate) <= new Date()) {
      newErrors.votingEndDate = 'Voting end date must be in the future';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
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
      setErrors({ form: 'Failed to create proposal. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px] sm:min-h-0">
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
          {errors.form && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {errors.form}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="proposal-title">Title</Label>
            <Input
              id="proposal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title..."
              maxLength={100}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'proposal-title-error' : undefined}
            />
            {errors.title && (
              <p id="proposal-title-error" role="alert" className="text-sm text-destructive">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="proposal-description">Description</Label>
            <Textarea
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the proposal in detail..."
              rows={4}
              maxLength={2000}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'proposal-description-error' : undefined}
            />
            {errors.description && (
              <p id="proposal-description-error" role="alert" className="text-sm text-destructive">
                {errors.description}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground text-right">{description.length}/2000</p>
          </div>

          {/* Proposal Type */}
          <div className="space-y-2">
            <Label htmlFor="proposal-type">Proposal Type</Label>
            <select
              id="proposal-type"
              value={proposalType}
              onChange={(e) => setProposalType(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              aria-invalid={!!errors.votingEndDate}
              aria-describedby={errors.votingEndDate ? 'voting-end-date-error' : undefined}
              className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.votingEndDate && (
              <p id="voting-end-date-error" role="alert" className="text-sm text-destructive">
                {errors.votingEndDate}
              </p>
            )}
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
                className="flex-1 accent-primary min-h-[44px]"
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
              className="min-h-[44px] sm:min-h-0"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-h-[44px] sm:min-h-0">
              {isSubmitting ? 'Creating...' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}