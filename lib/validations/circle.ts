import { z } from 'zod';

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
