import { z } from 'zod';

export const MAX_MEMBERS = 50;
export const HARD_CAP = MAX_MEMBERS;
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
  contributionAmount: z
    .number()
    .int('InvalidInput: contributionAmount must be an integer')
    .min(MIN_CONTRIBUTION_AMOUNT, `InvalidInput: min contribution is ${MIN_CONTRIBUTION_AMOUNT}`)
    .max(MAX_CONTRIBUTION_AMOUNT, `InvalidInput: max contribution is ${MAX_CONTRIBUTION_AMOUNT}`),
  contributionFrequencyDays: z
    .number()
    .int('InvalidInput: contributionFrequencyDays must be an integer')
    .min(MIN_FREQUENCY_DAYS, `InvalidInput: min frequency is ${MIN_FREQUENCY_DAYS} day`)
    .max(MAX_FREQUENCY_DAYS, `InvalidInput: max frequency is ${MAX_FREQUENCY_DAYS} days`),
  maxRounds: z
    .number()
    .int('InvalidInput: maxRounds must be an integer')
    .min(MIN_ROUNDS, `InvalidInput: min rounds is ${MIN_ROUNDS}`)
    .max(MAX_ROUNDS, `InvalidInput: max rounds is ${MAX_ROUNDS}`),
  // Optional multisig configuration
  multisigEnabled: z.boolean().optional(),
  multisigThreshold: z.number().min(0).optional(),
  requiredApprovals: z.number().int().min(1).max(10).optional(),
  approvers: z.array(z.string()).optional(),
});

// Update schema to include multisig fields
export const UpdateCircleSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50).optional(),
  description: z.string().max(500).optional(),
  contributionAmount: z
    .number()
    .int('InvalidInput: contributionAmount must be an integer')
    .min(MIN_CONTRIBUTION_AMOUNT, `InvalidInput: min contribution is ${MIN_CONTRIBUTION_AMOUNT}`)
    .max(MAX_CONTRIBUTION_AMOUNT, `InvalidInput: max contribution is ${MAX_CONTRIBUTION_AMOUNT}`),
  contributionFrequencyDays: z
    .number()
    .int('InvalidInput: contributionFrequencyDays must be an integer')
    .min(MIN_FREQUENCY_DAYS, `InvalidInput: min frequency is ${MIN_FREQUENCY_DAYS} day`)
    .max(MAX_FREQUENCY_DAYS, `InvalidInput: max frequency is ${MAX_FREQUENCY_DAYS} days`),
  maxRounds: z
    .number()
    .int('InvalidInput: maxRounds must be an integer')
    .min(MIN_ROUNDS, `InvalidInput: min rounds is ${MIN_ROUNDS}`)
    .max(MAX_ROUNDS, `InvalidInput: max rounds is ${MAX_ROUNDS}`),
  maxMembers: z
    .number()
    .int('InvalidInput: maxMembers must be an integer')
    .min(1, 'InvalidInput: maxMembers must be at least 1')
    .max(HARD_CAP, `InvalidInput: maxMembers cannot exceed hard cap ${HARD_CAP}`)
    .optional(),
});

export const UpdateCircleSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const ContributeSchema = z.object({
  amount: z
    .number()
    .int('InvalidInput: amount must be an integer')
    .min(MIN_CONTRIBUTION_AMOUNT, `InvalidInput: min contribution is ${MIN_CONTRIBUTION_AMOUNT}`)
    .max(MAX_CONTRIBUTION_AMOUNT, `InvalidInput: max contribution is ${MAX_CONTRIBUTION_AMOUNT}`),
});

export const BatchContributeSchema = z.object({
  contributions: z
    .array(
      z.object({
        userId: z.string().min(1, 'InvalidInput: userId is required'),
        amount: z
          .number()
          .int('InvalidInput: amount must be an integer')
          .min(MIN_CONTRIBUTION_AMOUNT, `InvalidInput: min contribution is ${MIN_CONTRIBUTION_AMOUNT}`)
          .max(MAX_CONTRIBUTION_AMOUNT, `InvalidInput: max contribution is ${MAX_CONTRIBUTION_AMOUNT}`),
      })
    )
    .min(1, 'InvalidInput: at least one contribution is required')
    .max(50, 'InvalidInput: maximum 50 contributions per batch'),
});

export type CreateCircleInput = z.infer<typeof CreateCircleSchema>;
export type UpdateCircleInput = z.infer<typeof UpdateCircleSchema>;
export type ContributeInput = z.infer<typeof ContributeSchema>;
export type BatchContributeInput = z.infer<typeof BatchContributeSchema>;
