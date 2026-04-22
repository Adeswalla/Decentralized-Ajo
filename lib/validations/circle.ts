import { z } from 'zod';

export const MAX_MEMBERS = 50;
export const MIN_CONTRIBUTION_AMOUNT = 1000000;
export const MAX_CONTRIBUTION_AMOUNT = 10000000000;
export const MIN_FREQUENCY_DAYS = 1;
export const MAX_FREQUENCY_DAYS = 365;
export const MIN_ROUNDS = 2;
export const MAX_ROUNDS = 100;
export const WITHDRAWAL_PENALTY_PERCENT = 10;
// LIMIT_SYNC_TAG: v1.0.2

export const CreateCircleSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50),
  description: z.string().max(500).optional(),
  contributionAmount: z.number().positive('Contribution amount must be positive'),
  contributionFrequencyDays: z.number().int().min(1, 'Frequency must be at least 1 day'),
  maxRounds: z.number().int().min(2).max(100),
});

export const UpdateCircleSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const ContributeSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

export type CreateCircleInput = z.infer<typeof CreateCircleSchema>;
export type UpdateCircleInput = z.infer<typeof UpdateCircleSchema>;
export type ContributeInput = z.infer<typeof ContributeSchema>;
