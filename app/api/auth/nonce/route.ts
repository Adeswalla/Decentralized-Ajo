import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateNonce } from 'siwe';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const nonce = generateNonce();
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await prisma.user.upsert({
      where: { walletAddress: address },
      update: { nonce, nonceExpiresAt },
      create: {
        walletAddress: address,
        nonce,
        nonceExpiresAt,
        email: `${address}@wallet.local`,
        password: '',
      },
    });

    return NextResponse.json({ nonce }, { status: 200 });
  } catch (error) {
    console.error('Error generating SIWE nonce:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
