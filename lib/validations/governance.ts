import { z } from 'zod';

export const CreateProposalSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  proposalType: z.enum([
    'RULE_CHANGE',
    'MEMBER_REMOVAL',
    'EMERGENCY_PAYOUT',
    'CIRCLE_DISSOLUTION',
    'CONTRIBUTION_ADJUSTMENT',
  ]),
  votingEndDate: z.string().refine(
    (val) => new Date(val) > new Date(),
    'Voting end date must be in the future',
  ),
  requiredQuorum: z.number().int().min(1).max(100).optional().default(50),
});

export const CastVoteSchema = z.object({
  voteChoice: z.enum(['YES', 'NO', 'ABSTAIN']),
});

export type CreateProposalInput = z.infer<typeof CreateProposalSchema>;
export type CastVoteInput = z.infer<typeof CastVoteSchema>;
