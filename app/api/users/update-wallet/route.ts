import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { isValidStellarAddress } from '@/lib/stellar-config';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { UpdateWalletSchema } from '@/lib/validations/user';
import { RATE_LIMITS } from '@/lib/rate-limit';

export async function PATCH(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'users:update-wallet', payload.userId);
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, UpdateWalletSchema);
  if (error) return error;

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
    console.error('Update wallet error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
