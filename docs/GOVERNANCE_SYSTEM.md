# Governance System: Proposals, Voting, Quorum, and On-Chain Dissolution

## What is Governance?

Each savings circle has a governance system that lets members vote on decisions that affect the circle. This prevents the organizer from making unilateral changes and gives all members a voice.

## Proposal Types

| Type | Description |
|------|-------------|
| RULE_CHANGE | Modify circle rules such as contribution frequency or payout order |
| MEMBER_REMOVAL | Vote to remove a member from the circle |
| EMERGENCY_PAYOUT | Trigger an out-of-order payout to a specific member |
| CIRCLE_DISSOLUTION | Vote to dissolve the circle and refund all members |
| CONTRIBUTION_ADJUSTMENT | Change the required contribution amount |

## Proposal Lifecycle

1. **Created** (status: **ACTIVE**)
   - Members vote **YES** / **NO** / **ABSTAIN**
   - `votingEndDate` passes
2. **Quorum met + majority YES** → status: **PASSED**
3. **Quorum met + majority NO** → status: **REJECTED**
4. **Quorum not met** → status: **REJECTED**

**Note**: The current implementation stores status in the database. Automatic status transitions based on `votingEndDate` require a cron job or on-demand recalculation (see the cron jobs issue for details).

## Creating a Proposal

### Via the UI
1. Navigate to `/circles/[id]/governance`
2. Click **"Create Proposal"**
3. Fill in the **CreateProposalDialog** form:
   - **Title** (3–100 characters)
   - **Description** (10–2000 characters)
   - **Proposal Type** — select from the 5 types above
   - **Voting End Date** — must be in the future
   - **Required Quorum** — percentage of members that must vote (default 50%)
4. **Submit**

### Via the API
```
POST /api/circles/:id/governance
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "title": "Increase contribution to 150 XLM",
  "description": "The current 100 XLM contribution is too low to build meaningful savings. Proposing an increase to 150 XLM starting next round.",
  "proposalType": "CONTRIBUTION_ADJUSTMENT",
  "votingEndDate": "2026-05-01T00:00:00.000Z",
  "requiredQuorum": 60
}
```

**Access control**: Only circle members or the organizer can create proposals. Returns 403 otherwise.

**On creation**: `votingStartDate` is set to now(), status is set to **ACTIVE**.

## Voting

### Via the UI
Each **ProposalCard** shows three vote buttons: **YES**, **NO**, **ABSTAIN**. Once voted, the user's choice is displayed and buttons are disabled.

### Via the API
```
POST /api/circles/:id/governance/:proposalId/vote
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "voteChoice": "YES"
}
```

**Constraints**:
- One vote per user per proposal (enforced by unique constraint `[proposalId, userId]` in the database)
- Attempting to vote twice returns an error

## Vote Tallying

The `GET /api/circles/:id/governance` endpoint enriches each proposal with computed fields:

| Field | Calculation |
|-------|-------------|
| `yesVotes` | Count of votes where `voteChoice === 'YES'` |
| `noVotes` | Count of votes where `voteChoice === 'NO'` |
| `abstainVotes` | Count of votes where `voteChoice === 'ABSTAIN'` |
| `totalVotes` | Total votes cast (yes + no + abstain) |
| `quorumPercentage` | `Math.round((totalVotes / totalMembers) * 100)` |
| `userVote` | The authenticated user's vote choice, or `null` if not voted |
| `totalMembers` | Snapshot of current member count |

## Quorum

`requiredQuorum` is the minimum percentage of members that must cast a vote for the result to be valid. Default is 50%.

**Example**: A circle with 10 members and `requiredQuorum: 60` requires at least 6 votes before the result is considered valid.

## On-Chain Dissolution via Smart Contract

When a **CIRCLE_DISSOLUTION** proposal passes, the off-chain governance result must be executed on-chain using the Soroban contract. The flow is:

1. Any member calls `start_dissolution_vote(caller, threshold_mode)` on the contract
   - `threshold_mode`: `0` = simple majority (>50%)
   - `threshold_mode`: `1` = supermajority (>66%)
2. Each member calls `vote_to_dissolve(member)` — the contract tracks votes and automatically transitions to **Dissolved** status when the threshold is met
3. Each member calls `dissolve_and_refund(member)` to claim their proportional refund

**Important**: The off-chain database governance and the on-chain contract dissolution are currently separate flows. A future integration task should link them so that a passed **CIRCLE_DISSOLUTION** proposal automatically triggers the on-chain dissolution sequence.

## Governance vs Emergency Panic

| Feature | Governance Dissolution | Emergency Panic |
|---------|------------------------|-----------------|
| **Who triggers** | Any member via proposal | Organizer only |
| **Requires vote** | Yes | No |
| **Refund penalty** | None | None |
| **On-chain function** | `dissolve_and_refund` | `emergency_refund` |
| **Blocks other operations** | No (until dissolved) | Yes (immediately) |

## Database Tables Involved

- **GovernanceProposal** — stores proposals
- **GovernanceVote** — stores individual votes with unique constraint per user per proposal

See the [Database Schema documentation](DATABASE_SCHEMA.md) for full field details.

