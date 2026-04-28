import { z } from 'zod';

export const WithdrawalRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
});

export const WithdrawalApprovalSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
});

export const MultisigConfigSchema = z.object({
  multisigEnabled: z.boolean(),
  multisigThreshold: z.number().min(0, 'Threshold must be non-negative'),
  requiredApprovals: z.number().int().min(1, 'At least 1 approval required').max(10, 'Maximum 10 approvals'),
  approvers: z.array(z.string()).min(1, 'At least one approver required'),
});

export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;
export type WithdrawalApproval = z.infer<typeof WithdrawalApprovalSchema>;
export type MultisigConfig = z.infer<typeof MultisigConfigSchema>;
