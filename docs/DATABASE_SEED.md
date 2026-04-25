# Database Seed

This document describes the test data inserted by `prisma/seed.ts`, how to run the seed, and how to extend it.

## Running the Seed

```bash
pnpm prisma db seed
```

> **Warning:** The seed script deletes **all existing data** before inserting fresh records. Never run it against a database with real user data.

The seed is configured via the `prisma.seed` field in `package.json`. If you need to add it, include:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

## What Gets Deleted

The script clears tables in this order to respect foreign key constraints:

1. `Contribution`
2. `GovernanceVote`
3. `GovernanceProposal`
4. `PaymentSchedule`
5. `Withdrawal`
6. `CircleMember`
7. `Circle`
8. `Session`
9. `User`

## Test Accounts

All accounts share the same password: **`TestPassword123!`**

| Email | Name | Role in seed data |
|---|---|---|
| alice@example.com | Alice Johnson | Organizer of "Office Team Savings"; member of that circle |
| bob@example.com | Bob Smith | Member of "Office Team Savings"; organizer of "Community Ajo" |
| charlie@example.com | Charlie Brown | Member of both circles |
| diana@example.com | Diana Prince | Member of "Community Ajo" only |

All accounts have `verified: true`.

## Test Circles

### Office Team Savings

| Field | Value |
|---|---|
| Organizer | Alice Johnson |
| Contribution amount | 100 XLM |
| Frequency | Every 7 days |
| Max rounds | 12 |
| Current round | 1 |
| Status | ACTIVE |

Members:

| Member | Rotation order | Total contributed |
|---|---|---|
| Alice | 1 | 300 XLM |
| Bob | 2 | 200 XLM |
| Charlie | 3 | 100 XLM |

### Community Ajo

| Field | Value |
|---|---|
| Organizer | Bob Smith |
| Contribution amount | 50 XLM |
| Frequency | Every 14 days |
| Max rounds | 8 |
| Current round | 2 |
| Status | ACTIVE |

Members:

| Member | Rotation order | Total contributed |
|---|---|---|
| Bob | 1 | 150 XLM |
| Charlie | 2 | 100 XLM |
| Diana | 3 | 150 XLM |

## Test Contributions

All contributions are for the "Office Team Savings" circle.

| Member | Amount | Round | Status |
|---|---|---|---|
| Alice | 100 XLM | 1 | COMPLETED |
| Bob | 100 XLM | 1 | COMPLETED |
| Charlie | 100 XLM | 1 | COMPLETED |
| Alice | 100 XLM | 2 | COMPLETED |
| Bob | 100 XLM | 2 | COMPLETED |

## Test Payment Schedules

Both schedules are for the "Office Team Savings" circle. Due dates are calculated relative to the time the seed runs.

| Round | Payee index | Expected amount | Due date | Status |
|---|---|---|---|---|
| 1 | 1 | 300 XLM | seed time + 7 days | COMPLETED |
| 2 | 2 | 300 XLM | seed time + 14 days | PENDING |

## Test Governance Proposal

Circle: **Office Team Savings**

| Field | Value |
|---|---|
| Title | Increase contribution amount |
| Description | Proposal to increase monthly contribution from 100 to 150 XLM |
| Type | CONTRIBUTION_ADJUSTMENT |
| Status | ACTIVE |
| Voting start | seed time |
| Voting end | seed time + 7 days |
| Required quorum | 50% |
| Proposal data | `{ "newAmount": 150 }` |

Votes cast:

| Voter | Choice |
|---|---|
| Alice | YES |
| Bob | YES |
| Charlie | NO |

## Customising the Seed

Edit `prisma/seed.ts` directly. A few common additions:

**Add a new user:**

```ts
const user5 = await prisma.user.create({
  data: {
    email: 'eve@example.com',
    password: await hashPassword('TestPassword123!'),
    firstName: 'Eve',
    lastName: 'Adams',
    verified: true,
  },
});
```

**Add a withdrawal record:**

```ts
await prisma.withdrawal.create({
  data: {
    circleId: circle1.id,
    userId: user1.id,
    amount: 90,            // net after 10% penalty
    requestedAmount: 100,  // original request
    penaltyPercentage: 10,
    reason: 'Emergency funds needed',
    status: 'COMPLETED',
  },
});
```

## Resetting and Re-seeding

```bash
# Reset the database — drops all data and re-runs migrations, then seeds
pnpm prisma migrate reset

# Re-run only the seed without touching migrations
pnpm prisma db seed
```
