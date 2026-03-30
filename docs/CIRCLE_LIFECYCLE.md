# Circle Lifecycle: Creation, Rounds, Payouts, and Dissolution

## Circle Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Circle created but not yet started |
| `ACTIVE` | Circle is running; contributions and payouts are in progress |
| `COMPLETED` | All rounds have finished |
| `CANCELLED` | Circle was cancelled before completion |

## Full Lifecycle

### Stage 1 — Creation
**Who**: Any authenticated user (becomes the organizer)

**How**: `POST /api/circles` with:
- `name`, `description`
- `contributionAmount` — how much each member contributes per round
- `contributionFrequencyDays` — how many days between rounds
- `maxRounds` — total number of rounds (= total number of members who will receive a payout)

**What happens**:
- Circle is created with status: **ACTIVE** and `currentRound`: 1
- Organizer is automatically added as the first `CircleMember` with `rotationOrder`: 1
- If deploying the smart contract: `initialize_circle()` is called on-chain with the same parameters

### Stage 2 — Member Recruitment
**Who**: Organizer

**How**: Share the circle ID or invite link. Members join via `POST /api/circles/:id/join`.

**On-chain**: Organizer calls `add_member(organizer, newMemberAddress)` for each new member.

**Constraints**:
- Maximum 50 members by default (hard cap 100 on-chain)
- Members cannot join once the circle is full

**Rotation order**: Before the first round begins, the organizer should call `shuffle_rotation()` on the smart contract to randomise the payout order using a Fisher-Yates shuffle seeded by the ledger sequence number.

### Stage 3 — Contribution Round
**Who**: All members

**How**: Each member calls `POST /api/circles/:id/contribute` with `{ amount }`.

**What happens per contribution**:
- A `Contribution` record is created with status: **COMPLETED** and the current round number
- The member's `totalContributed` is incremented in `CircleMember`
- All members who have **NOT** yet contributed this round receive a reminder email
- If all members have now contributed, the member whose `rotationOrder` matches `currentRound` receives a payout alert email

**On-chain**: The member calls `contribute(member, amount)` which transfers tokens from the member's wallet to the contract. The contract advances the round deadline when all members have contributed.

### Stage 4 — Payout
**Who**: The member whose turn it is (determined by `rotationOrder === currentRound`)

**How**: Member calls `claim_payout(member)` on the smart contract.

**Payout amount**: `contributionAmount × memberCount`

**Constraints**:
- If `shuffle_rotation()` was called, the contract enforces that only the correct member can claim
- Each member can only receive one payout (`hasReceivedPayout` flag)

**After payout**: `currentRound` increments and the next round begins.

### Stage 5 — Repeat
Stages 3 and 4 repeat for each round until `currentRound > maxRounds`.

### Stage 6 — Completion
When all `maxRounds` have been completed:
- Circle status is updated to **COMPLETED**
- All members have received exactly one payout
- Total paid out = `contributionAmount × memberCount × maxRounds`

## Partial Withdrawals

Members can withdraw a portion of their contributed funds at any time during an active circle, subject to a **10% penalty**.

**How**: Call `partial_withdraw(member, amount)` on the smart contract.

**Available balance**: `totalContributed - totalWithdrawn`

**Net received**: `amount - (amount × 10 / 100)`

**Example**: Requesting a 100 XLM withdrawal returns 90 XLM; 10 XLM is kept as a penalty.

**Note**: Partial withdrawals are blocked during **Panicked** state — use `emergency_refund` instead.

## Emergency Scenarios

### Organizer Panic
If the organizer detects a critical issue, they can call `panic(organizer)` on the smart contract. This:
- Immediately sets circle status to **Panicked**
- Blocks all contributions, payouts, and partial withdrawals
- Enables `emergency_refund` for every member (**no penalty**)

### Member-Initiated Dissolution
Any member can start a dissolution vote via `start_dissolution_vote`. If the vote passes:
- Circle status transitions to **Dissolved**
- Each member calls `dissolve_and_refund` to receive `totalContributed - totalWithdrawn` (**no penalty**)

## Member Rotation Order

The payout rotation determines who receives the pooled funds each round.

**Default**: Members are added in join order with sequential `rotationOrder` values.

**Shuffled**: The organizer calls `shuffle_rotation()` before round 1 to randomise the order. The shuffle uses Fisher-Yates with a seed derived from the ledger sequence number, making it verifiably random and tamper-resistant.

**Example** with 4 members and 100 XLM contribution:

| Round | Payout Recipient | Amount Received |
|-------|------------------|-----------------|
| 1 | Member at rotationOrder 1 | 400 XLM |
| 2 | Member at rotationOrder 2 | 400 XLM |
| 3 | Member at rotationOrder 3 | 400 XLM |
| 4 | Member at rotationOrder 4 | 400 XLM |

Each member contributes 100 XLM × 4 rounds = 400 XLM total, and receives 400 XLM once. **Net result**: zero loss, but each member gets access to a lump sum when it's their turn.

## Circle Statistics (Dashboard)

The dashboard displays these computed values for each circle:

| Stat | Calculation |
|------|-------------|
| **Members** | `circle.members.length` |
| **Current Round** | `circle.currentRound / circle.maxRounds` |
| **Per Contribution** | `circle.contributionAmount XLM` |
| **Payout Amount** | `circle.contributionAmount × circle.members.length XLM` |

