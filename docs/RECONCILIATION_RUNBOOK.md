# Chain vs DB Reconciliation Runbook

This document details how to interpret the reconciliation report and resolve data drift between the Prisma database and the Soroban on-chain state.

## Overview
The backend runs a scheduled cron job (`/api/cron/reconcile`) to verify that the canonical off-chain state for Ajo Circles perfectly mirrors the active smart contract state.

The job compares:
- `current_round`
- `member_count` (Active off-chain members vs on-chain count)
- `contribution_amount`

## Interpreting the Report
A typical report looks like this:
```json
{
  "timestamp": "2023-10-01T12:00:00Z",
  "checkedCount": 42,
  "discrepancies": [
    {
      "circleId": "clt9x8z",
      "contractAddress": "CABC123...",
      "deltas": {
        "currentRound": { "db": 4, "chain": 5 }
      }
    }
  ]
}
```

If `discrepancies` is an empty array, the system is fully synced. If items appear, manual intervention is required.

## Standard Operating Procedures (SOP)

### Scenario A: `currentRound` Drift
**Cause**: An off-chain webhook might have failed to register a round advancement event.
**Action**:
1. Check the Soroban explorer for the `contractAddress` to confirm the on-chain round.
2. If the chain is correct (e.g. 5) but the DB is behind (e.g. 4), run an admin DB script or use Prisma Studio to update `Circle.currentRound` to match the chain.
3. Review `Contribution` and `PaymentSchedule` tables to ensure they generated correctly for the advanced round.

### Scenario B: `memberCount` Drift
**Cause**: A user joined or left on-chain directly, or a webhook was lost during high traffic.
**Action**:
1. Query the chain or run a diagnostic script to enumerate the `member` addresses registered on-chain.
2. Compare the list with active `CircleMember` rows in the DB.
3. If an on-chain member is missing off-chain, create the `CircleMember` record and set their status to `ACTIVE`.
4. If an off-chain member does not exist on-chain, mark their `CircleMember` status as `PENDING` or `EXITED` depending on their wallet activity.

### Scenario C: `contributionAmount` Drift
**Cause**: Highly unusual. Typically means an administrator altered the DB row manually, or a fatal precision error occurred.
**Action**:
1. Verify if the DB or Chain holds the intended value.
2. If the DB is wrong, update `Circle.contributionAmount` in Prisma.
3. If the Chain is wrong, the contract might be compromised or initialized incorrectly. **Escalate immediately** to the engineering lead and consider calling emergency pause on the contract.

## Escalation Paths
If more than 10% of active circles show discrepancies, immediately disable the webhook event processor (it may be processing out-of-order events or stalling).
Alert the backend engineering team in `#alerts-engineering`.
