import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import {
  generateToken,
  generateRefreshToken,
  getRefreshTokenExpiryDate,
  isSecureCookieEnvironment,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@/lib/auth';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/auth/verify' });

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing message or signature' }, { status: 400 });
    }

    // Parse SIWE message
    let siwe: SiweMessage;
    try {
      siwe = new SiweMessage(message);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid SIWE message' }, { status: 400 });
    }

    const address = siwe.address;

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      select: { id: true, email: true, nonce: true, nonceExpiresAt: true },
    });

    if (!user || user.nonce !== siwe.nonce) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    if (!user.nonceExpiresAt || user.nonceExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Nonce has expired' }, { status: 401 });
    }

    // Verify signature recovers expected address
    try {
      const recovered = ethers.utils.verifyMessage(message, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // Consume nonce and mark wallet verified
    await prisma.user.update({
      where: { id: user.id },
      data: { isWalletVerified: true, nonce: null, nonceExpiresAt: null },
    });

    const accessToken = generateToken({ userId: user.id, email: user.email, walletAddress: address });
    const refreshToken = await generateRefreshToken(user.id);

    const response = NextResponse.json({ token: accessToken, address }, { status: 200 });
    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isSecureCookieEnvironment(),
      sameSite: 'strict',
      expires: getRefreshTokenExpiryDate(),
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Error verifying SIWE message', { err: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
