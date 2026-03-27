import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { amount } = body;

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid contribution amount' },
        { status: 400 }
      );
    }

    // Get circle
    const circle = await prisma.circle.findUnique({
      where: { id },
    });

    if (!circle) {
      return NextResponse.json(
        { error: 'Circle not found' },
        { status: 404 }
      );
    }

    // Check if user is a member
    const member = await prisma.circleMember.findUnique({
      where: {
        circleId_userId: {
          circleId: id,
          userId: payload.userId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this circle' },
        { status: 403 }
      );
    }

    // Create contribution
    const contribution = await prisma.contribution.create({
      data: {
        circleId: id,
        userId: payload.userId,
        amount,
        round: circle.currentRound,
        status: 'COMPLETED',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update member's total contributed
    await prisma.circleMember.update({
      where: {
        circleId_userId: {
          circleId: id,
          userId: payload.userId,
        },
      },
      data: {
        totalContributed: {
          increment: amount,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        contribution,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Contribute error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
