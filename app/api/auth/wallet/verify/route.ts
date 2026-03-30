import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { prisma } from '@/lib/prisma';
import { generateToken, generateRefreshToken, getRefreshTokenExpiryDate, isSecureCookieEnvironment, REFRESH_TOKEN_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { address, signature, nonce } = await request.json();

    if (!address || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, signature, nonce' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      select: { id: true, email: true, nonce: true, nonceExpiresAt: true },
    });

    if (!user || user.nonce !== nonce) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    if (!user.nonceExpiresAt || user.nonceExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Nonce has expired' }, { status: 401 });
    }

    // Verify Stellar signature
    try {
      const keypair = Keypair.fromPublicKey(address);
      const valid = keypair.verify(Buffer.from(nonce), Buffer.from(signature, 'base64'));
      if (!valid) throw new Error();
    } catch {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // Consume the nonce and mark wallet verified
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
    console.error('Error verifying wallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
