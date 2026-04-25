import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { errorResponse } from '@/lib/api-helpers';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger({ service: 'api', route: '/api/circles/[id]/export' });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return errorResponse(request, { code: 'unauthorized', message: 'Unauthorized' }, 401);

  const payload = verifyToken(token);
  if (!payload) return errorResponse(request, { code: 'invalid_token', message: 'Invalid or expired token' }, 401);

  try {
    const { id } = await params;

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, username: true, walletAddress: true },
            },
          },
          orderBy: { rotationOrder: 'asc' },
        },
        contributions: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!circle) return errorResponse(request, { code: 'not_found', message: 'Circle not found' }, 404);

    const isOrganizer = circle.organizerId === payload.userId;

    if (!isOrganizer) {
      return errorResponse(request, { code: 'forbidden', message: 'Forbidden - only organizers can export data' }, 403);
    }

    // Build contribution summary per member
    const contributionSummary = new Map<string, {
      totalContributed: number;
      completedContributions: number;
      pendingContributions: number;
      failedContributions: number;
      lastContributionDate: string | null;
    }>();

    circle.contributions.forEach(contribution => {
      const summary = contributionSummary.get(contribution.userId) || {
        totalContributed: 0,
        completedContributions: 0,
        pendingContributions: 0,
        failedContributions: 0,
        lastContributionDate: null,
      };

      if (contribution.status === 'COMPLETED') {
        summary.totalContributed += contribution.amount;
        summary.completedContributions += 1;
      } else if (contribution.status === 'PENDING') {
        summary.pendingContributions += 1;
      } else if (contribution.status === 'FAILED') {
        summary.failedContributions += 1;
      }

      if (!summary.lastContributionDate || contribution.createdAt > new Date(summary.lastContributionDate)) {
        summary.lastContributionDate = contribution.createdAt.toISOString();
      }

      contributionSummary.set(contribution.userId, summary);
    });

    // Generate CSV headers
    const headers = [
      'Member ID',
      'Email',
      'First Name',
      'Last Name',
      'Username',
      'Wallet Address',
      'Status',
      'Rotation Order',
      'Joined Date',
      'Left Date',
      'Has Received Payout',
      'Total Contributed (Database)',
      'Total Withdrawn',
      'Completed Contributions Count',
      'Pending Contributions Count',
      'Failed Contributions Count',
      'Total Contribution Amount',
      'Last Contribution Date',
    ];

    // Generate CSV rows
    const rows = circle.members.map(member => {
      const summary = contributionSummary.get(member.userId) || {
        totalContributed: 0,
        completedContributions: 0,
        pendingContributions: 0,
        failedContributions: 0,
        lastContributionDate: null,
      };

      return [
        member.user.id,
        member.user.email,
        member.user.firstName || '',
        member.user.lastName || '',
        member.user.username || '',
        member.user.walletAddress || '',
        member.status,
        member.rotationOrder,
        member.joinedAt.toISOString(),
        member.leftAt ? member.leftAt.toISOString() : '',
        member.hasReceivedPayout ? 'Yes' : 'No',
        member.totalContributed,
        member.totalWithdrawn,
        summary.completedContributions,
        summary.pendingContributions,
        summary.failedContributions,
        summary.totalContributed,
        summary.lastContributionDate || '',
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')),
    ].join('\n');

    // Return CSV with appropriate headers
    const filename = `circle-${circle.name.replace(/[^a-z0-9]/gi, '-')}-${id}.csv`;
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error('Export circle data error', { err });
    return errorResponse(request, { code: 'internal_error', message: 'Internal server error' }, 500);
  }
}
