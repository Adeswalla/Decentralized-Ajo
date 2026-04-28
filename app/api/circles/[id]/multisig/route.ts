import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { MultisigConfigSchema } from '@/lib/validations/withdrawal';
import { createChildLogger } from '@/server/config/logger';

const logger = createChildLogger('multisig-config-api');

/**
 * GET /api/circles/[id]/multisig
 * Get multisig configuration for a circle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Authorize user
  const { payload, error } = await authorize(request);
  if (error) return error;

  try {
    const circle = await prisma.circle.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizerId: true,
        multisigEnabled: true,
        multisigThreshold: true,
        requiredApprovals: true,
        approvers: true,
      },
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

    const approvers = circle.approvers ? JSON.parse(circle.approvers) : [];

    return NextResponse.json({
      multisigEnabled: circle.multisigEnabled,
      multisigThreshold: circle.multisigThreshold,
      requiredApprovals: circle.requiredApprovals,
      approvers,
      isOrganizer: circle.organizerId === payload.userId,
    });
  } catch (err: any) {
    logger.error('Failed to fetch multisig config', { err, circleId: id });
    return NextResponse.json(
      { error: 'Failed to fetch multisig configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/circles/[id]/multisig
 * Update multisig configuration (organizer only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Authorize user
  const { payload, error } = await authorize(request);
  if (error) return error;

  try {
    // Check if user is the organizer
    const circle = await prisma.circle.findUnique({
      where: { id },
      select: {
        organizerId: true,
        members: {
          select: { userId: true },
        },
      },
    });

    if (!circle) {
      return NextResponse.json(
        { error: 'Circle not found' },
        { status: 404 }
      );
    }

    if (circle.organizerId !== payload.userId) {
      return NextResponse.json(
        { error: 'Only the organizer can update multisig configuration' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const data = MultisigConfigSchema.parse(body);

    // Validate that all approvers are members of the circle
    const memberIds = circle.members.map((m) => m.userId);
    const invalidApprovers = data.approvers.filter(
      (approverId) => !memberIds.includes(approverId)
    );

    if (invalidApprovers.length > 0) {
      return NextResponse.json(
        {
          error: 'Some approvers are not members of this circle',
          invalidApprovers,
        },
        { status: 400 }
      );
    }

    // Validate that required approvals doesn't exceed number of approvers
    if (data.requiredApprovals > data.approvers.length) {
      return NextResponse.json(
        {
          error: 'Required approvals cannot exceed number of approvers',
          requiredApprovals: data.requiredApprovals,
          approverCount: data.approvers.length,
        },
        { status: 400 }
      );
    }

    // Update circle configuration
    const updatedCircle = await prisma.circle.update({
      where: { id },
      data: {
        multisigEnabled: data.multisigEnabled,
        multisigThreshold: data.multisigThreshold,
        requiredApprovals: data.requiredApprovals,
        approvers: JSON.stringify(data.approvers),
      },
      select: {
        id: true,
        name: true,
        multisigEnabled: true,
        multisigThreshold: true,
        requiredApprovals: true,
        approvers: true,
      },
    });

    logger.info('Multisig configuration updated', {
      circleId: id,
      organizerId: payload.userId,
      multisigEnabled: data.multisigEnabled,
      threshold: data.multisigThreshold,
      requiredApprovals: data.requiredApprovals,
    });

    return NextResponse.json({
      ...updatedCircle,
      approvers: JSON.parse(updatedCircle.approvers || '[]'),
    });
  } catch (err: any) {
    logger.error('Failed to update multisig config', { err, circleId: id });

    if (err.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: err.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update multisig configuration' },
      { status: 500 }
    );
  }
}
