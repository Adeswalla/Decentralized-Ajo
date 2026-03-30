import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { verifyStellarTx } from '@/lib/stellar-verify';

// Zod schema for input validation
const CreateAjoSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().optional(),
  txHash: z.string().min(10, 'Invalid transaction hash'),
});

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const ajos = await prisma.circle.findMany({
      where: {
        OR: [
          { organizerId: payload.userId },
          { members: { some: { userId: payload.userId } } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(ajos, { status: 200 });
  } catch (error) {
    console.error('List Ajos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, description, txHash } = CreateAjoSchema.parse(body);

    // Save to DB initially as PENDING
    // Adjust 'circle' to match your exact Prisma model name if different
    const newAjo = await prisma.circle.create({
      data: {
        name,
        description,
        txHash,
        organizerId: payload.userId, 
        status: 'PENDING', // Ensure your Prisma schema has a status field
      }
    });

    // Fire off asynchronous verification (Notice there is no 'await' here)
    verifyStellarTx(txHash, newAjo.id).catch(console.error);

    return NextResponse.json({ success: true, ajo: newAjo }, { status: 201 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Create Ajo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}