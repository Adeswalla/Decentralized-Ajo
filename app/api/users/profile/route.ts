import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { validateBody, applyRateLimit } from '@/lib/api-helpers';
import { UpdateProfileSchema } from '@/lib/validations/user';
import { RATE_LIMITS } from '@/lib/rate-limit';

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

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'users:profile-get', payload.userId);
  if (rateLimited) return rateLimited;

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: USER_SELECT });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Get profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload || !payload.walletAddress) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'users:profile-update', payload.walletAddress);
  if (rateLimited) return rateLimited;

  const { data, error } = await validateBody(request, UpdateProfileSchema);
  if (error) return error;

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
    console.error('Update profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}