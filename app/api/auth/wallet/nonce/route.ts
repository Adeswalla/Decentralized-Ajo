import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createChildLogger } from '@/lib/logger';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const logger = createChildLogger({ service: 'api', route: '/api/auth/wallet/nonce' });

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const nonce = crypto.randomUUID();
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await prisma.user.upsert({
      where: { walletAddress: address },
      update: { nonce, nonceExpiresAt },
      create: {
        walletAddress: address,
        nonce,
        nonceExpiresAt,
        email: `${address}@wallet.local`, // placeholder — wallet-only accounts
        password: '',
      },
    });

    return NextResponse.json({ nonce }, { status: 200 });
  } catch (error) {
    logger.error('Error generating wallet nonce', { err: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
