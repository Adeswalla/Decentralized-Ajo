/**
 * Bulk user registration endpoint
 * Closes #593
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';
import { sendVerificationEmail } from '@/lib/email';

const logger = createChildLogger({ service: 'api', route: '/api/auth/register/bulk' });

// Schema for a single user in bulk registration
const BulkUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

// Schema for bulk registration request
const BulkRegisterSchema = z.object({
  users: z.array(BulkUserSchema).min(1, 'At least one user is required').max(100, 'Maximum 100 users per request'),
});

type BulkUserInput = z.infer<typeof BulkUserSchema>;

interface RegistrationResult {
  email: string;
  success: boolean;
  error?: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  // Apply rate limiting (stricter for bulk operations)
  const rateLimited = await applyRateLimit(request, RATE_LIMITS.auth, 'auth:register:bulk');
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, BulkRegisterSchema);
  if (error) return error;

  const { users } = data as z.infer<typeof BulkRegisterSchema>;

  const results: RegistrationResult[] = [];
  const successfulRegistrations: Array<{ email: string; token: string }> = [];

  try {
    // Validate all passwords first
    for (const user of users) {
      const passwordValidation = validatePasswordStrength(user.password);
      if (!passwordValidation.isValid) {
        results.push({
          email: user.email,
          success: false,
          error: `Password does not meet strength requirements: ${passwordValidation.errors.join(', ')}`,
        });
      }
    }

    // Filter out users with invalid passwords
    const validUsers = users.filter(
      (user) => !results.find((r) => r.email === user.email && !r.success)
    );

    // Check for existing users
    const emails = validUsers.map((u) => u.email.toLowerCase());
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email));

    // Mark existing users as failed
    for (const user of validUsers) {
      if (existingEmails.has(user.email.toLowerCase())) {
        results.push({
          email: user.email,
          success: false,
          error: 'User with this email already exists',
        });
      }
    }

    // Filter to only new users
    const newUsers = validUsers.filter((user) => !existingEmails.has(user.email.toLowerCase()));

    if (newUsers.length === 0) {
      return NextResponse.json(
        {
          message: 'No new users to register',
          results,
          summary: {
            total: users.length,
            successful: 0,
            failed: results.length,
          },
        },
        { status: 400 }
      );
    }

    // Hash passwords for all new users
    const usersWithHashedPasswords = await Promise.all(
      newUsers.map(async (user) => ({
        email: user.email.toLowerCase(),
        password: await hashPassword(user.password),
        firstName: user.firstName,
        lastName: user.lastName,
      }))
    );

    // Use transaction to create users and verification tokens
    const createdUsers = await prisma.$transaction(async (tx: any) => {
      // Create all users at once using createMany
      await tx.user.createMany({
        data: usersWithHashedPasswords,
        skipDuplicates: true,
      });

      // Fetch the created users to get their IDs
      const created = await tx.user.findMany({
        where: {
          email: { in: usersWithHashedPasswords.map((u) => u.email) },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      // Create verification tokens for all users
      const verificationTokens = created.map((user) => ({
        token: crypto.randomBytes(32).toString('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }));

      await tx.verificationToken.createMany({
        data: verificationTokens,
      });

      return created.map((user, index) => ({
        ...user,
        verificationToken: verificationTokens[index].token,
      }));
    });

    // Add successful registrations to results
    for (const user of createdUsers) {
      results.push({
        email: user.email,
        success: true,
        userId: user.id,
      });

      successfulRegistrations.push({
        email: user.email,
        token: user.verificationToken,
      });
    }

    // Send verification emails asynchronously (don't block response)
    Promise.all(
      successfulRegistrations.map(({ email, token }) =>
        sendVerificationEmail(email, token).catch((err) => {
          logger.error('Failed to send verification email during bulk registration', {
            err,
            email,
          });
        })
      )
    ).catch((err) => {
      logger.error('Error sending bulk verification emails', { err });
    });

    const summary = {
      total: users.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    return NextResponse.json(
      {
        message: `Bulk registration completed. ${summary.successful} successful, ${summary.failed} failed.`,
        results,
        summary,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('Bulk registration error', { err });
    return NextResponse.json(
      {
        error: 'Internal server error during bulk registration',
        results,
        summary: {
          total: users.length,
          successful: results.filter((r) => r.success).length,
          failed: users.length - results.filter((r) => r.success).length,
        },
      },
      { status: 500 }
    );
  }
}
