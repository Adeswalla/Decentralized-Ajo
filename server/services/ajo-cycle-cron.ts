import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
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
      organizer: {
        select: {
          id: true,
          email: true,
          notificationEmail: true,
        },
      },
      members: {
        select: {
          userId: true,
          user: {
            select: {
              notificationEmail: true,
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
      await prisma.circle.update({
        where: { id: cycle.id },
        data: { status: 'ACTION_REQUIRED' },
      });

      await prisma.notification.createMany({
        data: [
          {
            userId: cycle.organizer.id,
            type: 'GENERAL',
            title: 'Ajo Cycle Ended - Action Required',
            message: `Your Ajo group "${cycle.name}" has reached its expected end date. Please review and take necessary action.`,
            circleId: cycle.id,
            link: `/ajo/${cycle.id}`,
          },
          ...cycle.members.map((member) => ({
            userId: member.userId,
            type: 'GENERAL' as const,
            title: 'Ajo Cycle Ended',
            message: `The Ajo group "${cycle.name}" has reached its expected end date. The organizer will review next steps.`,
            circleId: cycle.id,
            link: `/ajo/${cycle.id}`,
          })),
        ],
      });

      logger.info(`[cron:ajo-cycle] Updated cycle ${cycle.id} (${cycle.name}) to ACTION_REQUIRED`);
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
