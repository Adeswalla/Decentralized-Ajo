import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { sendPayoutAlert } from '@/lib/email';
import logger from '../config/logger';

const CRON_SCHEDULE = '0 * * * *';

async function processEndedAjoCycles(): Promise<void> {
  const now = new Date();

  const endedCycles = await prisma.circle.findMany({
    where: {
      status: 'ACTIVE',
      expectedEndDate: {
        lte: now,
      },
    },
    select: {
      id: true,
      name: true,
      expectedEndDate: true,
      currentRound: true,
      maxRounds: true,
      contributionAmount: true,
      organizer: {
        select: {
          id: true,
          email: true,
          notificationEmail: true,
        },
      },
      members: {
        where: { status: 'ACTIVE' },
        select: {
          userId: true,
          rotationOrder: true,
          hasReceivedPayout: true,
          user: {
            select: {
              email: true,
              notificationEmail: true,
              firstName: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (endedCycles.length === 0) {
    return;
  }

  logger.info(`[cron:ajo-cycle] Found ${endedCycles.length} ended Ajo cycles to process`);

  for (const cycle of endedCycles) {
    try {
      const winner = cycle.members.find(
        (m) => m.rotationOrder === cycle.currentRound && !m.hasReceivedPayout,
      );

      const isLastRound = cycle.currentRound >= cycle.maxRounds;
      const newStatus = isLastRound ? 'COMPLETED' : 'ACTION_REQUIRED';

      await prisma.circle.update({
        where: { id: cycle.id },
        data: {
          status: newStatus,
          currentRound: { increment: 1 },
        },
      });

      if (winner) {
        await prisma.circleMember.update({
          where: { circleId_userId: { circleId: cycle.id, userId: winner.userId } },
          data: { hasReceivedPayout: true },
        });
      }

      const winnerNotification = winner
        ? {
            userId: winner.userId,
            type: 'PAYOUT_TURN' as const,
            title: "It's your turn — payout ready!",
            message: `Your payout of ${cycle.contributionAmount} XLM is ready to claim from the Ajo group "${cycle.name}". Log in to your dashboard to claim it.`,
            circleId: cycle.id,
            link: `/ajo/${cycle.id}`,
          }
        : null;

      const otherMemberNotifications = cycle.members
        .filter((m) => m.userId !== winner?.userId)
        .map((member) => ({
          userId: member.userId,
          type: 'GENERAL' as const,
          title: isLastRound ? 'Ajo Cycle Completed' : 'Ajo Cycle Ended',
          message: isLastRound
            ? `The Ajo group "${cycle.name}" has completed all rounds successfully.`
            : `The Ajo group "${cycle.name}" has reached its expected end date. The organizer will review next steps.`,
          circleId: cycle.id,
          link: `/ajo/${cycle.id}`,
        }));

      const organizerNotification = {
        userId: cycle.organizer.id,
        type: 'GENERAL' as const,
        title: isLastRound ? 'Ajo Cycle Completed - Action Required' : 'Ajo Cycle Ended - Action Required',
        message: isLastRound
          ? `Your Ajo group "${cycle.name}" has completed all rounds. Please verify the final payout on-chain.`
          : `Your Ajo group "${cycle.name}" has reached its expected end date. Please verify the payout on-chain and confirm.`,
        circleId: cycle.id,
        link: `/ajo/${cycle.id}`,
      };

      await prisma.notification.createMany({
        data: [
          ...(winnerNotification ? [winnerNotification] : []),
          ...otherMemberNotifications,
          organizerNotification,
        ],
      });

      if (winner) {
        const winnerEmail = winner.user.notificationEmail ?? winner.user.email;
        const winnerName =
          winner.user.firstName ?? winner.user.username ?? winnerEmail;

        await sendPayoutAlert(winnerEmail, winnerName, cycle.contributionAmount);
      }

      logger.info(
        `[cron:ajo-cycle] Processed cycle ${cycle.id} (${cycle.name}) → ${newStatus}` +
          (winner ? ` | winner: ${winner.userId} (round ${cycle.currentRound})` : ' | no winner found for round'),
      );
    } catch (error) {
      logger.error(`[cron:ajo-cycle] Failed to process cycle ${cycle.id}`, { error });
    }
  }
}

export function startAjoCycleCronJob(): void {
  if (cron.validate(CRON_SCHEDULE)) {
    cron.schedule(CRON_SCHEDULE, async () => {
      logger.debug('[cron:ajo-cycle] Running hourly Ajo cycle check');
      try {
        await processEndedAjoCycles();
      } catch (error) {
        logger.error('[cron:ajo-cycle] Unexpected error during cycle processing', { error });
      }
    });
    logger.info(`[cron:ajo-cycle] Scheduled job started with pattern: ${CRON_SCHEDULE}`);
  } else {
    logger.error(`[cron:ajo-cycle] Invalid cron schedule pattern: ${CRON_SCHEDULE}`);
  }
}

export { processEndedAjoCycles };
