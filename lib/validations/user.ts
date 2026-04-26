import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  email: z.string().trim().email('Invalid email format').optional(),
  username: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .min(2, 'Username must be at least 2 characters')
        .max(32)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens'),
    ])
    .optional(),
  notificationEmail: z
    .union([z.literal(''), z.string().trim().email('Invalid email').max(255)])
    .optional(),
  bio: z.string().trim().max(160).optional(),
  phoneNumber: z.string().trim().max(20).optional(),
}).strict();

export const UpdateWalletSchema = z.object({
  walletAddress: z
    .string()
    .min(1, 'Wallet address is required')
    .refine(isValidStellarPublicKey, {
      message: 'Invalid Stellar public key format. Must be a 56-character address starting with G (e.g., GABCD...1234)',
    }),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateWalletInput = z.infer<typeof UpdateWalletSchema>;