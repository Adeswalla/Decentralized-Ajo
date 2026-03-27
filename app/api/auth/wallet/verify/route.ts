import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { prisma } from '@/lib/prisma';
import { extractToken, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const authHeader = request.headers.get('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { address, signature, nonce } = body;

    if (!address || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, signature, or nonce' },
        { status: 400 }
      );
    }

    // 3. Retrieve user from DB and check nonce
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, nonce: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // The nonce must match the one stored in the DB and cannot be empty
    if (!user.nonce || user.nonce !== nonce) {
      return NextResponse.json(
        { error: 'Invalid, reused, or expired nonce' },
        { status: 400 }
      );
    }

    // 4. Verify the signature using stellar-sdk
    let isValid = false;
    try {
      const keypair = Keypair.fromPublicKey(address);
      isValid = keypair.verify(Buffer.from(nonce), Buffer.from(signature, 'base64'));
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid address or signature format' },
        { status: 400 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 400 }
      );
    }

    // 5. Update user in DB (mark verified, set address, nullify nonce)
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        walletAddress: address, 
        isWalletVerified: true,
        nonce: null // Make it single-use
      },
    });

    return NextResponse.json(
      { success: true, message: 'Wallet successfully verified' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying wallet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}