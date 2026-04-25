import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { sendContributionReminder } from '@/lib/email';
import { createChildLogger } from '../config/logger';

const logger = createChildLogger({ service: 'express', module: 'deadline-reminder-cron' });

function parseLeadTimes(): number[] {
  const envValue = process.env.REMINDER_LEAD_TIME_HOURS || '24,1';
  return envValue
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

function getCronSchedule(): string {
  return process.env.REMINDER_CRON_SCHEDULE || '0 * * * *';
}

function isReminderEnabled(): boolean {
  const envValue = process.env.ENABLE_DEADLINE_REMINDERS;
  if (!envValue) return true;
  return envValue.toLowerCase() !== 'false';
}

async function processDeadlineReminders(): Promise<void> {
  if (!isReminderEnabled()) {
    logger.debug('[cron:deadline-reminder] Reminders disabled via ENABLE_DEADLINE_REMINDERS flag');
    return;
  }

  const leadTimes = parseLeadTimes();
  if (leadTimes.length === 0) {
    logger.warn('[cron:deadline-reminder] No valid lead times configured, skipping');
    return;
  }

  logger.info(`[cron:deadline-reminder] Starting reminder check with lead times: ${leadTimes.join(', ')} hours`);

  const now = new Date();
  let totalSkipped = 0;
  let totalSent = 0;
  let totalErrors = 0;

  for (const leadTimeHours of leadTimes) {
    const result = await processRemindersForLeadTime(leadTimeHours, now);
    totalSkipped += result.skipped;
    totalSent += result.sent;
    totalErrors += result.errors;
  }

  logger.info(`[cron:deadline-reminder] Completed | Sent: ${totalSent} | Skipped (already notified): ${totalSkipped} | Errors: ${totalErrors}`);
}

async function processRemindersForLeadTime(
  leadTimeHours: number,
  now: Date
): Promise<{ sent: number; skipped: number; errors: number }> {
  const targetTime = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

  const circlesWithUpcomingDeadlines = await prisma.circle.findMany({
    where: {
      status: 'ACTIVE',
      payments: {
        some: {
          status: 'PENDING',
          dueDate: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      contributionAmount: true,
      currentRound: true,
      members: {
        where: { status: 'ACTIVE' },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              notificationEmail: true,
              firstName: true,
              username: true,
              settings: {
                select: {
                  receiveEmailNotifs: true,
                },
              },
            },
          },
        },
      },
      payments: {
        where: {
          status: 'PENDING',
          dueDate: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        select: {
          id: true,
          round: true,
          dueDate: true,
        },
      },
      contributions: {
        where: {
          round: circle.currentRound,
          status: 'COMPLETED',
        },
        select: {
          userId: true,
          round: true,
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const circle of circlesWithUpcomingDeadlines) {
    const contributedUserIds = new Set(
      circle.contributions.map((c) => c.userId)
    );

    for (const member of circle.members) {
      if (contributedUserIds.has(member.userId)) {
        continue;
      }

      try {
        const existingReminder = await prisma.deadlineReminder.findUnique({
          where: {
            userId_circleId_round_leadTimeHours: {
              userId: member.userId,
              circleId: circle.id,
              round: circle.currentRound,
              leadTimeHours,
            },
          },
        });

        if (existingReminder) {
          skipped++;
          continue;
        }

        const email = member.user.notificationEmail ?? member.user.email;
        const userName = member.user.firstName ?? member.user.username ?? email;

        await sendContributionReminder(
          email,
          userName,
          circle.contributionAmount,
          circle.name
        );

        await prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'CONTRIBUTION_REMINDER',
            title: 'Contribution Deadline Reminder',
            message: `Your contribution of ${circle.contributionAmount} XLM is due for the circle "${circle.name}" in ${leadTimeHours} hour${leadTimeHours !== 1 ? 's' : ''}. Please contribute before the deadline.`,
            circleId: circle.id,
            link: `/circles/${circle.id}`,
          },
        });

        await prisma.deadlineReminder.create({
          data: {
            userId: member.userId,
            circleId: circle.id,
            round: circle.currentRound,
            leadTimeHours,
          },
        });

        sent++;
        logger.debug(
          `[cron:deadline-reminder] Sent reminder to ${email} for circle ${circle.name} (round ${circle.currentRound}, ${leadTimeHours}h before deadline)`
        );
      } catch (err) {
        errors++;
        logger.error(`[cron:deadline-reminder] Failed to send reminder to user ${member.userId}`, {
          err,
          userId: member.userId,
          circleId: circle.id,
          leadTimeHours,
        });
      }
    }
  }

  return { sent, skipped, errors };
}

export function startDeadlineReminderCronJob(): void {
  if (!isReminderEnabled()) {
    logger.info('[cron:deadline-reminder] Reminders disabled via ENABLE_DEADLINE_REMINDERS flag');
    return;
  }

  const cronSchedule = getCronSchedule();

  if (!cron.validate(cronSchedule)) {
    logger.error(`[cron:deadline-reminder] Invalid cron schedule pattern: ${cronSchedule}`);
    return;
  }

  cron.schedule(cronSchedule, async () => {
    logger.debug('[cron:deadline-reminder] Running deadline reminder check');
    try {
      await processDeadlineReminders();
    } catch (error) {
      logger.error('[cron:deadline-reminder] Unexpected error during reminder processing', { err: error });
    }
  });

  logger.info(`[cron:deadline-reminder] Scheduled job started with pattern: ${cronSchedule}`);
  logger.info(`[cron:deadline-reminder] Lead times: ${parseLeadTimes().join(', ')} hours`);
}

export { processDeadlineReminders, parseLeadTimes, isReminderEnabled };
