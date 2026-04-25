import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateBody, applyRateLimit, authorize } from '@/lib/api-helpers';
import { UpdateProfileSchema } from '@/lib/validations/user';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createChildLogger } from '@/lib/logger';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  notificationEmail: true,
  bio: true,
  phoneNumber: true,
  profilePicture: true,
  walletAddress: true,
  createdAt: true,
};

const logger = createChildLogger({ service: 'api', route: '/api/users/profile' });

export async function GET(request: NextRequest) {
  const { payload, error } = await authorize(request, ['user:read']);
  if (error) return error;

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'users:profile', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: USER_SELECT });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    logger.error('Get profile error', { err, userId: payload.userId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { payload, error } = await authorize(request, ['user:write']);
  if (error) return error;

  // For users, we still need a walletAddress. For services, we might not.
  const identifier = payload.walletAddress || payload.serviceName || payload.userId || 'unknown';

  const rateLimited = await applyRateLimit(request, RATE_LIMITS.api, 'users:profile-update', identifier);
  if (rateLimited) return rateLimited;

  const { data, error: validationError } = await validateBody(request, UpdateProfileSchema);
  if (validationError) return validationError;

  try {
    const user = await prisma.user.update({
      where: { walletAddress: payload.walletAddress },
      data: {
        ...(data.email !== undefined && { 
            email: data.email.trim().toLowerCase() 
        }),
        ...(data.username !== undefined && {
          username: data.username.trim() === '' ? null : data.username.trim(),
        }),
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
        ...(data.notificationEmail !== undefined && {
          notificationEmail: data.notificationEmail.trim() === '' ? null : data.notificationEmail.trim(),
        }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
      },
      select: USER_SELECT,
    });

    return NextResponse.json({ success: true, user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'That username or email is already taken' }, { status: 409 });
    }
    logger.error('Update profile error', {
      err,
      userId: payload.userId,
      walletAddress: payload.walletAddress,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
