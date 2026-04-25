# Payment Schedule System

## Overview

This document explains the payment schedule system: what PaymentSchedule records represent, how they are created, how statuses work, and how they map to round progression and on-chain payouts.

## What Is a Payment Schedule?

A PaymentSchedule record represents a planned payout for a specific round of a circle. It tracks:

- Which round the payout is for.
- Which member is the payee (by rotation index).
- How much they are expected to receive.
- When the payout is due.
- Whether it has been paid.

## PaymentSchedule Model

| Field | Type | Description |
|---|---|---|
| id | string | CUID primary key |
| circleId | string | FK to Circle |
| round | int | Round number covered by this schedule |
| payeeIndex | int | 1-based index into the rotation order |
| expectedAmount | float | contributionAmount x memberCount |
| dueDate | datetime | When contributions for this round are due |
| status | PaymentStatus | Current payout state |
| paidAt | datetime? | Set when status becomes COMPLETED |
| createdAt | datetime | Auto-set |
| updatedAt | datetime | Auto-updated |

## Payment Statuses

| Status | Description |
|---|---|
| PENDING | Payout is scheduled but not yet initiated |
| INITIATED | Payout process has started |
| COMPLETED | Payout has been successfully delivered |
| OVERDUE | Due date has passed without completion |
| FAILED | Payout attempt failed |

## How Payment Schedules Are Created

Payment schedules are created by the seed script for test data. In production, they should be created when a circle is initialized or when a new round begins.

Seed data example:

```ts
await prisma.paymentSchedule.create({
  data: {
    circleId: circle1.id,
    round: 1,
    payeeIndex: 1,
    expectedAmount: 300,   // 100 XLM x 3 members
    dueDate: nextWeek,
    status: 'COMPLETED',
  },
});

await prisma.paymentSchedule.create({
  data: {
    circleId: circle1.id,
    round: 2,
    payeeIndex: 2,
    expectedAmount: 300,
    dueDate: nextTwoWeeks,
    status: 'PENDING',
  },
});
```

## Relationship to Circle Rounds

Each circle has maxRounds rounds. Ideally, one PaymentSchedule record should exist per round and be created upfront when the circle starts:

- Round 1 -> PaymentSchedule { round: 1, payeeIndex: 1, dueDate: startDate + frequency }
- Round 2 -> PaymentSchedule { round: 2, payeeIndex: 2, dueDate: startDate + 2 x frequency }
- ...
- Round N -> PaymentSchedule { round: N, payeeIndex: N, dueDate: startDate + N x frequency }

expectedAmount = circle.contributionAmount x circle.members.length

## Relationship to On-Chain State

The PaymentSchedule table is the off-chain record of planned payouts. The actual payout is executed on-chain via claim_payout(member) on the Soroban contract.

When a member successfully calls claim_payout on-chain, the corresponding PaymentSchedule record should be updated to:

- status: COMPLETED
- paidAt: now

This synchronization step is not yet automated and is a known gap.

## Overdue Detection

A cron job or scheduled task should periodically check for PaymentSchedule records where:

- status = PENDING
- dueDate < now

Then update them to status = OVERDUE and notify the circle organizer.

This is referenced in the cron jobs issue as a task to implement.

## Indexes

The PaymentSchedule table has these indexes for query performance:

- circleId
- status
- composite: [circleId, status]

These support efficient queries such as finding all pending payment schedules for a circle.

## Example Query

```ts
// Find all overdue payment schedules
const overdue = await prisma.paymentSchedule.findMany({
  where: {
    status: 'PENDING',
    dueDate: { lt: new Date() },
  },
  include: {
    circle: { select: { name: true, organizerId: true } },
  },
});
```
