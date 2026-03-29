import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Fetch user's Ajo groups through the UserAjo junction table
    const userAjos = await prisma.userAjo.findMany({
      where: {
        userAddress: address,
      },
      include: {
        ajo: true,
      },
    });

    // Transform data for frontend
    const ajos = userAjos.map(({ ajo }) => ({
      id: ajo.id,
      name: ajo.name,
      contractAddress: ajo.contractAddress,
      contributionAmt: ajo.contributionAmt,
      cycleDuration: ajo.cycleDuration,
      maxMembers: ajo.maxMembers,
      status: ajo.status,
      createdAt: ajo.createdAt,
    }));

    return NextResponse.json(ajos);
  } catch (error) {
    console.error('Error fetching user ajos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user ajos' },
      { status: 500 }
    );
  }
}
