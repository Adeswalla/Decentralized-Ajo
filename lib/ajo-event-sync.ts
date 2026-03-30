/**
 * ajo-event-sync.ts
 *
 * On-chain event listener integration for Ajo group participation.
 *
 * When a MemberJoined event is emitted from the smart contract, call
 * `syncAjoMemberJoined` to confirm the off-chain UserAjoParticipation record.
 *
 * Usage (wire this up in your blockchain event listener / webhook handler):
 *
 *   import { syncAjoMemberJoined } from '@/lib/ajo-event-sync';
 *   await syncAjoMemberJoined({ ajoId, walletAddress, txHash });
 */

import { prisma } from '@/lib/prisma';

interface MemberJoinedEvent {
  /** The Circle/Ajo id (off-chain) */
  ajoId: string;
  /** The wallet address emitted by the contract event */
  walletAddress: string;
  /** Transaction hash of the on-chain event */
  txHash: string;
}

/**
 * Confirms an off-chain UserAjoParticipation record when the corresponding
 * on-chain MemberJoined event is received.
 *
 * - Looks up the user by walletAddress.
 * - Updates the participation status from PENDING → CONFIRMED.
 * - Records the txHash and confirmedAt timestamp.
 * - If no off-chain record exists yet (e.g. user joined on-chain directly),
 *   it creates one in CONFIRMED state so the off-chain state stays consistent.
 */
export async function syncAjoMemberJoined({ ajoId, walletAddress, txHash }: MemberJoinedEvent): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true },
  });

  if (!user) {
    console.warn(`[ajo-event-sync] No user found for walletAddress ${walletAddress}. Skipping sync.`);
    return;
  }

  await prisma.userAjoParticipation.upsert({
    where: { userId_ajoId: { userId: user.id, ajoId } },
    update: {
      status: 'CONFIRMED',
      onChainTxHash: txHash,
      confirmedAt: new Date(),
    },
    create: {
      userId: user.id,
      ajoId,
      status: 'CONFIRMED',
      onChainTxHash: txHash,
      confirmedAt: new Date(),
    },
  });

  console.info(`[ajo-event-sync] Confirmed participation for user ${user.id} in ajo ${ajoId} (tx: ${txHash})`);
}

/**
 * Marks a participant as EXITED when a MemberLeft on-chain event is received.
 */
export async function syncAjoMemberLeft({ ajoId, walletAddress, txHash }: MemberJoinedEvent): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true },
  });

  if (!user) {
    console.warn(`[ajo-event-sync] No user found for walletAddress ${walletAddress}. Skipping sync.`);
    return;
  }

  await prisma.userAjoParticipation.updateMany({
    where: { userId: user.id, ajoId },
    data: {
      status: 'EXITED',
      onChainTxHash: txHash,
      leftAt: new Date(),
    },
  });

  console.info(`[ajo-event-sync] Marked participation as EXITED for user ${user.id} in ajo ${ajoId} (tx: ${txHash})`);
}
