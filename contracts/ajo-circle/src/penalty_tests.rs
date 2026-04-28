#![cfg(test)]

//! Tests for the penalty system in partial_withdraw().
//!
//! Issue #682 — The late fee logic involves complex math that is prone to errors.
//! These tests manipulate the ledger timestamp to simulate late contributions and
//! verify that the 10% penalty is calculated and deducted with perfect accuracy.
//!
//! Penalty formula (WITHDRAWAL_PENALTY_PERCENT = 10):
//!   net_contributed = total_contributed - total_withdrawn
//!   penalty         = net_contributed * 10 / 100
//!   refund          = net_contributed - penalty

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const CONTRIBUTION: i128 = 1_000_000; // satisfies MIN_CONTRIBUTION_AMOUNT

fn base_ledger() -> LedgerInfo {
    LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 20,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3_110_400,
    }
}

/// Register contract, create token, mint to addresses, initialize circle.
/// Returns (client, token_address, organizer, member).
fn setup(env: &Env) -> (AjoCircleClient, Address, Address, Address) {
    env.ledger().set(base_ledger());

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let organizer = Address::generate(env);
    let member = Address::generate(env);

    let token_admin = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(token_admin.clone());
    let sac = token::StellarAssetClient::new(env, &token_address);

    // Mint enough for multiple deposits + pre-fund contract for payouts
    for addr in [&organizer, &member] {
        sac.mint(addr, &100_000_000_i128);
    }
    sac.mint(&contract_id, &100_000_000_i128);

    client.initialize_circle(
        &organizer,
        &token_address,
        &CONTRIBUTION,
        &7_u32,  // frequency_days
        &12_u32, // max_rounds
        &5_u32,  // max_members
    );

    client.join_circle(&organizer, &member);

    (client, token_address, organizer, member)
}

// ─── penalty math accuracy ────────────────────────────────────────────────────

/// Single deposit: penalty = 10% of CONTRIBUTION, refund = 90%.
#[test]
fn test_penalty_single_deposit_exact_math() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, _organizer, member) = setup(&env);
    let token = token::Client::new(&env, &token_address);

    client.deposit(&member).unwrap();

    let before = token.balance(&member);
    let refund = client.partial_withdraw(&member).unwrap();

    let expected_penalty = CONTRIBUTION * 10 / 100; // 100_000
    let expected_refund = CONTRIBUTION - expected_penalty; // 900_000

    assert_eq!(refund, expected_refund);
    assert_eq!(token.balance(&member), before + expected_refund);
}

/// Two deposits: net = 2 * CONTRIBUTION, penalty = 10%, refund = 90%.
#[test]
fn test_penalty_two_deposits_exact_math() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, _organizer, member) = setup(&env);
    let token = token::Client::new(&env, &token_address);

    client.deposit(&member).unwrap();
    client.deposit(&member).unwrap();

    let net = CONTRIBUTION * 2;
    let expected_penalty = net * 10 / 100;
    let expected_refund = net - expected_penalty;

    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
    assert_eq!(token.balance(&member), 100_000_000 - net + expected_refund);
}

/// Five deposits: verifies penalty scales linearly with net_contributed.
#[test]
fn test_penalty_scales_linearly_with_contributions() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    for _ in 0..5 {
        client.deposit(&member).unwrap();
    }

    let net = CONTRIBUTION * 5;
    let expected_refund = net - net * 10 / 100; // 90% of net

    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
}

/// Penalty is always exactly 10% (integer division floors toward zero).
#[test]
fn test_penalty_is_exactly_ten_percent() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    client.deposit(&member).unwrap();

    let net = CONTRIBUTION;
    let penalty = net * 10 / 100;
    let refund = client.partial_withdraw(&member).unwrap();

    assert_eq!(refund, net - penalty);
    // Confirm penalty is exactly 10%
    assert_eq!(penalty, net / 10);
}

/// After partial_withdraw, member status is set to Exited (2) and
/// total_withdrawn is updated to reflect the refund.
#[test]
fn test_partial_withdraw_updates_member_state() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    client.deposit(&member).unwrap();
    let refund = client.partial_withdraw(&member).unwrap();

    let data = client.get_member_balance(&member).unwrap();
    assert_eq!(data.total_withdrawn, refund);
    assert_eq!(data.status, 2); // Exited
}

/// Pool is decremented by exactly the refund amount after partial_withdraw.
#[test]
fn test_partial_withdraw_decrements_pool_by_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, organizer, member) = setup(&env);

    client.deposit(&organizer).unwrap();
    client.deposit(&member).unwrap();

    let pool_before = client.get_total_pool();
    let refund = client.partial_withdraw(&member).unwrap();
    let pool_after = client.get_total_pool();

    assert_eq!(pool_after, pool_before - refund);
}

// ─── ledger timestamp simulation ─────────────────────────────────────────────

/// Deposit at t=0, advance ledger past the round deadline, then withdraw.
/// Penalty math must be identical regardless of when the withdrawal happens.
#[test]
fn test_penalty_after_late_deposit_same_math() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    // Deposit at the initial timestamp
    client.deposit(&member).unwrap();

    // Advance ledger by 10 days (past the 7-day frequency window)
    let mut info = base_ledger();
    info.timestamp = 1_000_000 + 10 * 86_400;
    env.ledger().set(info);

    let net = CONTRIBUTION;
    let expected_refund = net - net * 10 / 100;

    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
}

/// Deposit recorded at a specific timestamp; verify get_last_deposit_timestamp
/// reflects the ledger time at deposit, then penalty is still 10% on withdrawal.
#[test]
fn test_deposit_timestamp_recorded_then_penalty_correct() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    // Set a specific deposit time
    let deposit_time: u64 = 1_000_000 + 3 * 86_400; // 3 days in
    let mut info = base_ledger();
    info.timestamp = deposit_time;
    env.ledger().set(info);

    client.deposit(&member).unwrap();

    // Verify timestamp was recorded correctly
    assert_eq!(
        client.get_last_deposit_timestamp(&member),
        Ok(deposit_time)
    );

    // Advance ledger to simulate late withdrawal (past deadline)
    let mut late_info = base_ledger();
    late_info.timestamp = 1_000_000 + 14 * 86_400; // 14 days in
    env.ledger().set(late_info);

    let net = CONTRIBUTION;
    let expected_refund = net - net * 10 / 100;
    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
}

/// Multiple deposits at different timestamps; penalty is based on total
/// net_contributed regardless of when each deposit was made.
#[test]
fn test_penalty_multiple_deposits_at_different_timestamps() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    // First deposit at t=0
    client.deposit(&member).unwrap();

    // Second deposit 5 days later
    let mut info = base_ledger();
    info.timestamp = 1_000_000 + 5 * 86_400;
    env.ledger().set(info);
    client.deposit(&member).unwrap();

    // Third deposit 12 days later (past deadline)
    info.timestamp = 1_000_000 + 12 * 86_400;
    env.ledger().set(info);
    client.deposit(&member).unwrap();

    // Withdraw 20 days in
    info.timestamp = 1_000_000 + 20 * 86_400;
    env.ledger().set(info);

    let net = CONTRIBUTION * 3;
    let expected_refund = net - net * 10 / 100;
    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
}

/// Deposit at round start, advance past deadline, deposit again (late),
/// then withdraw — penalty applies to the full net_contributed.
#[test]
fn test_penalty_includes_late_deposit_in_net_contributed() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    // On-time deposit
    client.deposit(&member).unwrap();

    // Advance past the 7-day deadline
    let mut info = base_ledger();
    info.timestamp = 1_000_000 + 8 * 86_400;
    env.ledger().set(info);

    // Late deposit (contract doesn't block it, but timestamp is recorded)
    client.deposit(&member).unwrap();

    // Verify last deposit timestamp reflects the late time
    assert_eq!(
        client.get_last_deposit_timestamp(&member),
        Ok(1_000_000 + 8 * 86_400)
    );

    // Penalty applies to both deposits combined
    let net = CONTRIBUTION * 2;
    let expected_refund = net - net * 10 / 100;
    let refund = client.partial_withdraw(&member).unwrap();
    assert_eq!(refund, expected_refund);
}

// ─── error conditions ─────────────────────────────────────────────────────────

/// partial_withdraw fails with InsufficientFunds when member has no net balance.
#[test]
fn test_partial_withdraw_no_contributions_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    // No deposits made
    let result = client.partial_withdraw(&member);
    assert_eq!(result, Err(AjoError::InsufficientFunds));
}

/// partial_withdraw fails for a non-member.
#[test]
fn test_partial_withdraw_non_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, _member) = setup(&env);
    let stranger = Address::generate(&env);

    let result = client.partial_withdraw(&stranger);
    assert_eq!(result, Err(AjoError::NotFound));
}

/// partial_withdraw is blocked when the circle is paused (panicked).
#[test]
fn test_partial_withdraw_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, organizer, member) = setup(&env);

    client.deposit(&member).unwrap();
    client.panic(&organizer).unwrap();

    let result = client.partial_withdraw(&member);
    assert_eq!(result, Err(AjoError::Paused));
}

/// After a partial_withdraw, a second call fails with InsufficientFunds
/// because total_contributed == total_withdrawn.
#[test]
fn test_partial_withdraw_double_withdraw_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    client.deposit(&member).unwrap();
    client.partial_withdraw(&member).unwrap();

    let result = client.partial_withdraw(&member);
    assert_eq!(result, Err(AjoError::InsufficientFunds));
}

// ─── penalty vs. full payout comparison ──────────────────────────────────────

/// Penalty reduces the refund by exactly 10% compared to a full refund
/// (no penalty) of the same net_contributed amount.
#[test]
fn test_penalty_reduces_refund_by_ten_percent_vs_full() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, _organizer, member) = setup(&env);

    client.deposit(&member).unwrap();

    let net = CONTRIBUTION;
    let full_refund = net; // what member would get with no penalty
    let refund = client.partial_withdraw(&member).unwrap();

    // Refund must be exactly 10% less than the full amount
    assert_eq!(refund, full_refund * 90 / 100);
    assert_eq!(full_refund - refund, full_refund * 10 / 100);
}
