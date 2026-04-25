# Smart Contract Test Suite

## Overview

This document explains the current smart contract test suite in contracts/ajo-circle/src/lib.rs, what is already covered, what is missing, and how to add new tests.

## Running the Tests

```bash
cd contracts/ajo-circle

# Run all tests
cargo test

# Run a specific test
cargo test test_panic_happy_path

# Run with output (see println! statements)
cargo test -- --nocapture
```

## Test Helper

All tests use a shared helper:

setup_circle_with_member(env) -> (client, organizer, member, token_address)

### What setup_circle_with_member sets up

- Deploys the contract.
- Creates organizer and member addresses.
- Deploys a Stellar asset contract as the token.
- Mints 1000 tokens to both organizer and member.
- Calls initialize_circle with:
  - contribution = 100
  - frequency = 7 days
  - max_rounds = 12
  - max_members = 5
- Calls add_member to add the member.
- Organizer and member both call contribute(200).

Post-setup balances: each participant has 800 tokens remaining (1000 minted - 200 contributed).

## Existing Tests

### Member Limit Enforcement

Test: enforce_member_limit_at_contract_level

Verifies add_member returns CircleAtCapacity when member count reaches max_members.

Setup: circle with max_members = 2, then tries to add 3 members.

Expected: first two joins succeed, third returns Err(AjoError::CircleAtCapacity).

### Panic Button - Happy Path

Test: test_panic_happy_path

Verifies organizer can trigger panic state.

Steps:

1. Assert is_panicked() is false before panic.
2. Organizer calls panic(organizer).
3. Assert result is Ok(()).
4. Assert is_panicked() is true.
5. Assert get_circle_status() is CircleStatus::Panicked.

### Panic Button - Unauthorized

Test: test_panic_only_organizer

Verifies a regular member cannot trigger panic.

Steps:

1. Member calls panic(member).
2. Assert result is Err(AjoError::Unauthorized).
3. Assert is_panicked() is still false.

### Emergency Refund During Panic

Test: test_emergency_refund_during_panic

Verifies members can claim full refunds after panic with no penalty.

Steps:

1. Assert member balance is 800.
2. Organizer triggers panic.
3. Member calls emergency_refund(member) and assert Ok(200).
4. Assert member balance is back to 1000.
5. Organizer calls emergency_refund(organizer) and assert Ok(200).
6. Assert organizer balance is back to 1000.
7. Member calls emergency_refund again and assert Err(AjoError::InsufficientFunds).

### Emergency Refund Without Panic

Test: test_emergency_refund_without_panic

Verifies emergency_refund cannot be called when circle is not panicked.

Steps:

1. Call emergency_refund(member) on active circle.
2. Assert result is Err(AjoError::CircleNotActive).

### Panic Blocks Contributions

Test: test_panic_blocks_contribute (truncated in source - needs verification)

Verifies contribute is blocked after panic is triggered.

## Test Coverage Gaps

The following scenarios are not yet covered and should be added:

| Scenario | Function to Test |
|---|---|
| Normal contribution and payout flow | contribute -> claim_payout |
| Rotation order enforcement | shuffle_rotation -> claim_payout with wrong member |
| Partial withdrawal with penalty | partial_withdraw |
| Partial withdrawal exceeding balance | partial_withdraw with amount > available |
| Dissolution vote - simple majority | start_dissolution_vote -> vote_to_dissolve -> dissolve_and_refund |
| Dissolution vote - supermajority | Same with threshold_mode = 1 |
| Double voting prevention | vote_to_dissolve called twice by same member |
| Dissolution blocks normal operations | contribute after Dissolved status |
| join_circle blocked during panic | join_circle when Panicked |
| claim_payout blocked during panic | claim_payout when Panicked |
| partial_withdraw blocked during panic | partial_withdraw when Panicked |
| Already dissolved circle | panic on a Dissolved circle |
| Round deadline advancement | Verify RoundDeadline updates after all members contribute |
| Max members hard cap | initialize_circle with max_members > 100 |

## Writing New Tests

Follow the existing structure:

```rust
#[test]
fn test_your_scenario() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, token_address) = setup_circle_with_member(&env);

    // Arrange
    // ...

    // Act
    let result = client.your_function(&arg);

    // Assert
    assert_eq!(result, Ok(expected_value));
}
```

Use env.mock_all_auths() to bypass signature verification in tests. For tests that specifically check auth failures, call require_auth manually without mocking.
