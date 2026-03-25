import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { applyRateLimit } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';

const CreateAjoSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  contractAddress: z.string().optional(),
  maxMembers: z.number().int().min(2).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const rateLimited = applyRateLimit(request, RATE_LIMITS.api, 'ajos:create', payload.userId);
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateAjoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { name, description, contractAddress, maxMembers } = parsed.data;

  try {
    const newAjo = await prisma.circle.create({
      data: {
        name,
        description,
        contractAddress,
        organizerId: payload.userId,
        // maxMembers maps to the Circle model; store in maxRounds as member cap if no dedicated field
        maxRounds: maxMembers ?? 12,
        contributionAmount: 0, // caller should update via PATCH when setting up the circle
      },
      select: {
        id: true,
        name: true,
        description: true,
        contractAddress: true,
        organizerId: true,
        maxRounds: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, ajo: newAjo }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ajos] creation failed:', err);
    return NextResponse.json({ error: 'Ajo group creation failed.' }, { status: 400 });
  }
}
