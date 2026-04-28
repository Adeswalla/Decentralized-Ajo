import { z } from 'zod';

/**
 * Schema for emergency circle dissolution request
 */
export const DissolutionRequestSchema = z.object({
  proposalId: z.string().optional(),
  reason: z.string().optional(),
});

export type DissolutionRequestInput = z.infer<typeof DissolutionRequestSchema>;
