import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidStellarAddress } from '@/lib/stellar-config';
import { validateBody, applyRateLimit, authorize } from '@/lib/api-helpers';
import { UpdateWalletSchema } from '@/lib/validations/user';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/users/update-wallet' });

export async function PATCH(request: NextRequest) {
  const { payload, error } = await authorize(request, ['user:write']);
  if (error) return error;

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'users:update-wallet', payload.userId);
  if (rateLimited) return rateLimited;

  const { data, error: validationError } = await validateBody(request, UpdateWalletSchema);
  if (validationError) return validationError;

  if (!isValidStellarAddress(data.walletAddress)) {
    return NextResponse.json({ error: 'Invalid Stellar wallet address' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { walletAddress: data.walletAddress },
      select: { id: true, email: true, firstName: true, lastName: true, walletAddress: true },
    });

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (err) {
    logger.error('Update wallet error', { err, userId: payload.userId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
