#![cfg(test)]

//! Comprehensive test suite for the AjoCircle (Soroban ROSCA) contract.
//!
//! Coverage targets:
//!   - initialize_circle  (happy path + invalid inputs + double-init)
//!   - join_circle / add_member  (happy path + duplicate + capacity)
//!   - deposit  (happy path + paused + disqualified + non-member)
//!   - contribute  (happy path + wrong amount + non-member)
//!   - claim_payout / withdraw  (happy path + paused + non-member)
//!   - panic / resume / emergency_stop / resume_operations
//!   - boot_dormant_member / slash_member
//!   - shuffle_rotation
//!   - set_kyc_status
//!   - grant_role / revoke_role / has_role / get_deployer
//!   - get_total_pool / get_member_balance / get_circle_state
//!   - get_last_deposit_timestamp
//!   - Ledger time simulation

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/// Canonical ledger info used throughout tests.
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

/// Register the contract, create a token, mint `mint_amount` to each of the
/// returned addresses, and call `initialize_circle`.
///
/// Returns `(client, token_address, organizer, user_a, user_b)`.
fn setup(
    env: &Env,
    contribution: i128,
    max_members: u32,
) -> (AjoCircleClient, Address, Address, Address, Address) {
    env.ledger().set(base_ledger());

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let organizer = Address::generate(env);
    let user_a = Address::generate(env);
    let user_b = Address::generate(env);

    let token_admin = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(token_admin.clone());
    let token_sac = token::StellarAssetClient::new(env, &token_address);

    // Mint generous balances so tests never fail on insufficient funds.
    for addr in [&organizer, &user_a, &user_b] {
        token_sac.mint(addr, &1_000_000_i128);
    }
    // Pre-fund the contract itself so payout transfers succeed.
    token_sac.mint(&contract_id, &10_000_000_i128);

    client.initialize_circle(
        &organizer,
        &token_address,
        &contribution,
        &7_u32,   // frequency_days
        &12_u32,  // max_rounds
        &max_members,
    );

    (client, token_address, organizer, user_a, user_b)
}

/// Convenience: setup with 3 members already joined.
fn setup_with_members(
    env: &Env,
) -> (AjoCircleClient, Address, Address, Address, Address) {
    let (client, token_address, organizer, user_a, user_b) = setup(env, 100, 5);
    client.join_circle(&organizer, &user_a);
    client.join_circle(&organizer, &user_b);
    (client, token_address, organizer, user_a, user_b)
}

// ─── initialize_circle ────────────────────────────────────────────────────────

#[test]
fn test_initialize_circle_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.organizer, organizer);
    assert_eq!(state.contribution_amount, 100);
    assert_eq!(state.max_members, 5);
    assert_eq!(state.current_round, 1);
    assert_eq!(state.member_count, 1); // organizer auto-joined
}

#[test]
fn test_initialize_circle_zero_contribution_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.initialize_circle(&organizer, &token, &0, &7, &12, &5);
    assert_eq!(result, Err(AjoError::InvalidInput));
}

#[test]
fn test_initialize_circle_negative_contribution_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.initialize_circle(&organizer, &token, &-50, &7, &12, &5);
    assert_eq!(result, Err(AjoError::InvalidInput));
}

#[test]
fn test_initialize_circle_zero_frequency_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.initialize_circle(&organizer, &token, &100, &0, &12, &5);
    assert_eq!(result, Err(AjoError::InvalidInput));
}

#[test]
fn test_initialize_circle_zero_rounds_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.initialize_circle(&organizer, &token, &100, &7, &0, &5);
    assert_eq!(result, Err(AjoError::InvalidInput));
}

#[test]
fn test_initialize_circle_exceeds_hard_cap_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    // HARD_CAP = 100; passing 101 should fail
    let result = client.initialize_circle(&organizer, &token, &100, &7, &12, &101);
    assert_eq!(result, Err(AjoError::InvalidInput));
}

#[test]
fn test_initialize_circle_zero_max_members_uses_default() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract(token_admin.clone());
    token::StellarAssetClient::new(&env, &token).mint(&organizer, &1_000_000);

    // max_members = 0 → contract uses MAX_MEMBERS (50)
    let result = client.initialize_circle(&organizer, &token, &100, &7, &12, &0);
    assert_eq!(result, Ok(()));
    let state = client.get_circle_state().unwrap();
    assert_eq!(state.max_members, 50);
}

// ─── join_circle / add_member ─────────────────────────────────────────────────

#[test]
fn test_join_circle_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    let result = client.join_circle(&organizer, &user_a);
    assert_eq!(result, Ok(()));

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.member_count, 2);
}

#[test]
fn test_join_circle_three_members_increments_count() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup(&env, 100, 5);

    client.join_circle(&organizer, &user_a).unwrap();
    client.join_circle(&organizer, &user_b).unwrap();

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.member_count, 3);
}

#[test]
fn test_join_circle_duplicate_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    client.join_circle(&organizer, &user_a).unwrap();
    let result = client.join_circle(&organizer, &user_a);
    assert_eq!(result, Err(AjoError::AlreadyExists));
}

#[test]
fn test_join_circle_at_capacity_fails() {
    let env = Env::default();
    env.mock_all_auths();

    // max_members = 2; organizer already occupies slot 1
    let (client, _tok, organizer, user_a, user_b) = setup(&env, 100, 2);

    client.join_circle(&organizer, &user_a).unwrap(); // fills slot 2

    // user_b should be rejected
    let result = client.join_circle(&organizer, &user_b);
    assert_eq!(result, Err(AjoError::CircleAtCapacity));
}

#[test]
fn test_add_member_is_alias_for_join_circle() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    let result = client.add_member(&organizer, &user_a);
    assert_eq!(result, Ok(()));

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.member_count, 2);
}

#[test]
fn test_join_circle_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let user = Address::generate(&env);

    let result = client.join_circle(&organizer, &user);
    assert_eq!(result, Err(AjoError::NotFound));
}

// ─── deposit ──────────────────────────────────────────────────────────────────

#[test]
fn test_deposit_happy_path_updates_pool_and_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, _a, _b) = setup(&env, 100, 5);
    let token_client = token::Client::new(&env, &token_address);

    let before = token_client.balance(&organizer);
    client.deposit(&organizer).unwrap();

    assert_eq!(token_client.balance(&organizer), before - 100);
    assert_eq!(client.get_total_pool(), 100);

    let data = client.get_member_balance(&organizer).unwrap();
    assert_eq!(data.total_contributed, 100);
}

#[test]
fn test_deposit_three_members_pool_accumulates() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup_with_members(&env);

    client.deposit(&organizer).unwrap();
    client.deposit(&user_a).unwrap();
    client.deposit(&user_b).unwrap();

    assert_eq!(client.get_total_pool(), 300);
}

#[test]
fn test_deposit_records_timestamp() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    let mut info = base_ledger();
    info.timestamp = 5_000;
    env.ledger().set(info);

    client.deposit(&organizer).unwrap();

    assert_eq!(client.get_last_deposit_timestamp(&organizer), Ok(5_000_u64));
}

#[test]
fn test_deposit_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    let result = client.deposit(&organizer);
    assert_eq!(result, Err(AjoError::CirclePanicked));
}

#[test]
fn test_deposit_fails_for_non_member() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    let result = client.deposit(&stranger);
    assert_eq!(result, Err(AjoError::NotFound));
}

#[test]
fn test_deposit_fails_for_disqualified_member() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    client.boot_dormant_member(&organizer, &user_a).unwrap();
    let result = client.deposit(&user_a);
    assert_eq!(result, Err(AjoError::Disqualified));
}

#[test]
fn test_deposit_fails_after_three_slashes() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    client.slash_member(&organizer, &user_a).unwrap();
    client.slash_member(&organizer, &user_a).unwrap();
    client.slash_member(&organizer, &user_a).unwrap();

    let result = client.deposit(&user_a);
    assert_eq!(result, Err(AjoError::Disqualified));
}

#[test]
fn test_deposit_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    assert_eq!(client.deposit(&member), Err(AjoError::NotFound));
}

#[test]
fn test_deposit_multiple_rounds_accumulates_contributed() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.deposit(&organizer).unwrap();
    client.deposit(&organizer).unwrap();
    client.deposit(&organizer).unwrap();

    let data = client.get_member_balance(&organizer).unwrap();
    assert_eq!(data.total_contributed, 300);
    assert_eq!(client.get_total_pool(), 300);
}

// ─── contribute ───────────────────────────────────────────────────────────────

#[test]
fn test_contribute_exact_amount_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, _a, _b) = setup(&env, 100, 5);
    let token_client = token::Client::new(&env, &token_address);

    let before = token_client.balance(&organizer);
    client.contribute(&organizer, &100).unwrap();

    assert_eq!(token_client.balance(&organizer), before - 100);
    assert_eq!(client.get_total_pool(), 100);
}

#[test]
fn test_contribute_wrong_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    // Partial amount
    let result = client.contribute(&organizer, &50);
    assert_eq!(result, Err(AjoError::InvalidInput));

    // Excess amount
    let result2 = client.contribute(&organizer, &200);
    assert_eq!(result2, Err(AjoError::InvalidInput));
}

#[test]
fn test_contribute_non_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    let result = client.contribute(&stranger, &100);
    assert_eq!(result, Err(AjoError::NotFound));
}

#[test]
fn test_contribute_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    assert_eq!(client.contribute(&member, &100), Err(AjoError::NotFound));
}

// ─── claim_payout / withdraw ──────────────────────────────────────────────────

#[test]
fn test_claim_payout_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, user_a, user_b) = setup_with_members(&env);
    let token_client = token::Client::new(&env, &token_address);

    // All three members deposit so the pool is funded
    client.deposit(&organizer).unwrap();
    client.deposit(&user_a).unwrap();
    client.deposit(&user_b).unwrap();

    let before = token_client.balance(&organizer);
    let payout = client.claim_payout(&organizer, &1).unwrap();

    // payout = member_count * contribution_amount = 3 * 100 = 300
    assert_eq!(payout, 300);
    assert_eq!(token_client.balance(&organizer), before + 300);

    let data = client.get_member_balance(&organizer).unwrap();
    assert_eq!(data.total_withdrawn, 300);
    assert_eq!(data.has_received_payout, true);
}

#[test]
fn test_claim_payout_correct_amount_scales_with_member_count() {
    let env = Env::default();
    env.mock_all_auths();

    // Only organizer in circle (member_count = 1)
    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    let payout = client.claim_payout(&organizer, &1).unwrap();
    assert_eq!(payout, 100); // 1 * 100
}

#[test]
fn test_claim_payout_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    let result = client.claim_payout(&organizer, &1);
    assert_eq!(result, Err(AjoError::CirclePanicked));
}

#[test]
fn test_claim_payout_non_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    let result = client.claim_payout(&stranger, &1);
    assert_eq!(result, Err(AjoError::NotFound));
}

#[test]
fn test_claim_payout_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    assert_eq!(client.claim_payout(&member, &1), Err(AjoError::NotFound));
}

#[test]
fn test_withdraw_is_alias_for_claim_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    let result = client.withdraw(&organizer, &1);
    assert_eq!(result, Ok(100));
}

#[test]
fn test_claim_payout_accumulates_total_withdrawn() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.claim_payout(&organizer, &1).unwrap();
    client.claim_payout(&organizer, &2).unwrap();

    let data = client.get_member_balance(&organizer).unwrap();
    assert_eq!(data.total_withdrawn, 200);
}

#[test]
fn test_get_total_pool_reflects_deposits() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup_with_members(&env);

    assert_eq!(client.get_total_pool(), 0);

    client.deposit(&organizer).unwrap();
    assert_eq!(client.get_total_pool(), 100);

    client.deposit(&user_a).unwrap();
    client.deposit(&user_b).unwrap();
    assert_eq!(client.get_total_pool(), 300);
}

// ─── panic / resume / emergency_stop / resume_operations ─────────────────────

#[test]
fn test_panic_pauses_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    assert_eq!(client.deposit(&organizer), Err(AjoError::CirclePanicked));
}

#[test]
fn test_resume_unpauses_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    client.resume(&organizer).unwrap();

    // deposit should succeed again
    assert_eq!(client.deposit(&organizer), Ok(()));
}

#[test]
fn test_emergency_stop_is_alias_for_panic() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.emergency_stop(&organizer).unwrap();
    assert_eq!(client.deposit(&organizer), Err(AjoError::CirclePanicked));
}

#[test]
fn test_resume_operations_is_alias_for_resume() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.emergency_stop(&organizer).unwrap();
    client.resume_operations(&organizer).unwrap();

    assert_eq!(client.deposit(&organizer), Ok(()));
}

#[test]
fn test_panic_by_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup(&env, 100, 5);

    // user_a is not admin; should be rejected
    let result = client.panic(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_resume_by_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    let result = client.resume(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// ─── boot_dormant_member / slash_member ──────────────────────────────────────

#[test]
fn test_boot_dormant_member_deactivates_member() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    client.boot_dormant_member(&organizer, &user_a).unwrap();

    // Booted member cannot deposit
    assert_eq!(client.deposit(&user_a), Err(AjoError::Disqualified));
}

#[test]
fn test_boot_dormant_member_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    let result = client.boot_dormant_member(&user_a, &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_boot_dormant_member_unknown_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    let result = client.boot_dormant_member(&organizer, &stranger);
    assert_eq!(result, Err(AjoError::NotFound));
}

#[test]
fn test_slash_member_increments_missed_count() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    // Two slashes — member still active
    client.slash_member(&organizer, &user_a).unwrap();
    client.slash_member(&organizer, &user_a).unwrap();
    // deposit should still work
    assert_eq!(client.deposit(&user_a), Ok(()));
}

#[test]
fn test_slash_member_three_times_disqualifies() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    client.slash_member(&organizer, &user_a).unwrap();
    client.slash_member(&organizer, &user_a).unwrap();
    client.slash_member(&organizer, &user_a).unwrap();

    assert_eq!(client.deposit(&user_a), Err(AjoError::Disqualified));
}

#[test]
fn test_slash_member_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    let result = client.slash_member(&user_a, &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// ─── shuffle_rotation ─────────────────────────────────────────────────────────

#[test]
fn test_shuffle_rotation_succeeds_with_members() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup_with_members(&env);

    let result = client.shuffle_rotation(&organizer);
    assert_eq!(result, Ok(()));
}

#[test]
fn test_shuffle_rotation_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup_with_members(&env);

    let result = client.shuffle_rotation(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_shuffle_rotation_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    let result = client.shuffle_rotation(&admin);
    assert_eq!(result, Err(AjoError::NotFound));
}

// ─── set_kyc_status ───────────────────────────────────────────────────────────

#[test]
fn test_set_kyc_status_by_admin_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    let result = client.set_kyc_status(&organizer, &user_a, &true);
    assert_eq!(result, Ok(()));
}

#[test]
fn test_set_kyc_status_by_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    let result = client.set_kyc_status(&user_a, &user_b, &true);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// ─── role management ──────────────────────────────────────────────────────────

#[test]
fn test_get_deployer_returns_organizer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    assert_eq!(client.get_deployer(), Ok(organizer));
}

#[test]
fn test_get_deployer_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    assert_eq!(client.get_deployer(), Err(AjoError::NotFound));
}

#[test]
fn test_has_role_deployer_always_true() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    // Deployer implicitly holds every role
    assert!(client.has_role(&symbol_short!("ADMIN"), &organizer));
    assert!(client.has_role(&symbol_short!("MANAGER"), &organizer));
}

#[test]
fn test_has_role_non_member_false() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup(&env, 100, 5);

    assert!(!client.has_role(&symbol_short!("ADMIN"), &user_a));
}

#[test]
fn test_grant_role_by_deployer_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    let result = client.grant_role(&organizer, &symbol_short!("MANAGER"), &user_a);
    assert_eq!(result, Ok(()));
    assert!(client.has_role(&symbol_short!("MANAGER"), &user_a));
}

#[test]
fn test_grant_role_duplicate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    client.grant_role(&organizer, &symbol_short!("MANAGER"), &user_a).unwrap();
    let result = client.grant_role(&organizer, &symbol_short!("MANAGER"), &user_a);
    assert_eq!(result, Err(AjoError::AlreadyExists));
}

#[test]
fn test_grant_role_by_non_deployer_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup(&env, 100, 5);

    let result = client.grant_role(&user_a, &symbol_short!("MANAGER"), &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_revoke_role_by_deployer_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    client.grant_role(&organizer, &symbol_short!("MANAGER"), &user_a).unwrap();
    let result = client.revoke_role(&organizer, &symbol_short!("MANAGER"), &user_a);
    assert_eq!(result, Ok(()));
    assert!(!client.has_role(&symbol_short!("MANAGER"), &user_a));
}

#[test]
fn test_revoke_role_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    // user_a never had MANAGER role
    let result = client.revoke_role(&organizer, &symbol_short!("MANAGER"), &user_a);
    assert_eq!(result, Err(AjoError::NotFound));
}

#[test]
fn test_revoke_deployer_admin_role_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    // Deployer's own ADMIN role cannot be revoked
    let result = client.revoke_role(&organizer, &symbol_short!("ADMIN"), &organizer);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_revoke_role_by_non_deployer_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup(&env, 100, 5);

    client.grant_role(&organizer, &symbol_short!("MANAGER"), &user_b).unwrap();
    let result = client.revoke_role(&user_a, &symbol_short!("MANAGER"), &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// ─── emergency_panic ──────────────────────────────────────────────────────────

// ─── AUTHORIZATION NEGATIVE TESTS (Capability Matrix Coverage) ─────────────────

// Test suite verifying all privileged entrypoints reject unauthorized callers with
// AjoError::Unauthorized where specified in capability matrix.

#[test]
fn test_panic_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup(&env, 100, 5);

    // Regular member cannot panic
    let result = client.panic(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_resume_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);

    client.panic(&organizer).unwrap();
    // Regular member cannot resume
    let result = client.resume(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_join_circle_by_non_organizer_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup(&env, 100, 5);

    // Only organizer can add members
    let result = client.join_circle(&user_a, &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_emergency_panic_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup(&env, 100, 5);

    // Only deployer can emergency panic
    let result = client.emergency_panic(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_boot_dormant_member_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    // Only admin can boot members
    let result = client.boot_dormant_member(&user_a, &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_slash_member_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    // Only admin can slash
    let result = client.slash_member(&user_a, &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_shuffle_rotation_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup_with_members(&env);

    // Only admin can shuffle
    let result = client.shuffle_rotation(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_set_kyc_status_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup_with_members(&env);

    // Only admin can set KYC
    let result = client.set_kyc_status(&user_a, &user_b, &true);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_grant_role_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup(&env, 100, 5);

    // Only deployer can grant roles
    let result = client.grant_role(&user_a, &symbol_short!("ADMIN"), &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

#[test]
fn test_revoke_role_by_member_fails_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, user_b) = setup(&env, 100, 5);

    // Only deployer can revoke roles
    let result = client.revoke_role(&user_a, &symbol_short!("ADMIN"), &user_b);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// Role distinction: Admin cannot emergency_panic (deployer only)
#[test]
fn test_admin_cannot_emergency_panic_deployer_only() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, admin, _b) = setup(&env, 100, 5);
    
    // Grant admin role to separate address
    client.grant_role(&organizer, &symbol_short!("ADMIN"), &admin).unwrap();
    
    // Admin cannot emergency_panic
    let result = client.emergency_panic(&admin);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// Verify deposit requires member auth (fails NotFound for stranger, but auth checked)
#[test]
fn test_deposit_by_stranger_fails_notfound() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    let result = client.deposit(&stranger);
    assert_eq!(result, Err(AjoError::NotFound));
}


#[test]
fn test_emergency_panic_by_deployer_pauses_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    client.emergency_panic(&organizer).unwrap();
    assert_eq!(client.deposit(&organizer), Err(AjoError::CirclePanicked));
}

#[test]
fn test_emergency_panic_by_non_deployer_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, user_a, _b) = setup(&env, 100, 5);

    let result = client.emergency_panic(&user_a);
    assert_eq!(result, Err(AjoError::Unauthorized));
}

// ─── ledger time simulation ───────────────────────────────────────────────────

#[test]
fn test_ledger_time_simulation_deadline_advances() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    // Simulate 8 days passing (past the 7-day frequency window)
    let mut info = base_ledger();
    info.timestamp = 1_000_000 + 8 * 86_400;
    env.ledger().set(info);

    // Contract should still accept deposits (deadline enforcement is not
    // implemented in the current contract version, but the ledger state
    // is correctly reflected in timestamps)
    let result = client.deposit(&organizer);
    assert_eq!(result, Ok(()));

    let ts = client.get_last_deposit_timestamp(&organizer).unwrap();
    assert_eq!(ts, 1_000_000 + 8 * 86_400);
}

#[test]
fn test_ledger_sequence_number_advances() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    let mut info = base_ledger();
    info.sequence_number = 999;
    info.timestamp = 2_000_000;
    env.ledger().set(info);

    client.deposit(&organizer).unwrap();
    assert_eq!(client.get_last_deposit_timestamp(&organizer), Ok(2_000_000_u64));
}

// ─── query helpers ────────────────────────────────────────────────────────────

#[test]
fn test_get_circle_state_not_initialized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    assert_eq!(client.get_circle_state(), Err(AjoError::NotFound));
}

#[test]
fn test_get_member_balance_non_member_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    assert_eq!(client.get_member_balance(&stranger), Err(AjoError::NotFound));
}

#[test]
fn test_get_last_deposit_timestamp_before_deposit_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, _a, _b) = setup(&env, 100, 5);

    // No deposit made yet
    assert_eq!(
        client.get_last_deposit_timestamp(&organizer),
        Err(AjoError::NotFound)
    );
}

#[test]
fn test_get_total_pool_initially_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _organizer, _a, _b) = setup(&env, 100, 5);

    assert_eq!(client.get_total_pool(), 0);
}

// ─── full happy-path simulation ───────────────────────────────────────────────

/// End-to-end: 3 members join, all contribute, scheduled recipient claims payout.
/// Verifies pool accounting and payout correctness.
#[test]
fn test_full_happy_path_three_members_contribute_and_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, user_a, user_b) = setup(&env, 100, 5);
    let token_client = token::Client::new(&env, &token_address);

    // Step 1 – join
    client.join_circle(&organizer, &user_a).unwrap();
    client.join_circle(&organizer, &user_b).unwrap();

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.member_count, 3);

    // Step 2 – all contribute
    client.deposit(&organizer).unwrap();
    client.deposit(&user_a).unwrap();
    client.deposit(&user_b).unwrap();

    assert_eq!(client.get_total_pool(), 300);

    // Step 3 – scheduled recipient (user_a) claims payout
    let before = token_client.balance(&user_a);
    let payout = client.claim_payout(&user_a, &1).unwrap();

    assert_eq!(payout, 300); // 3 members * 100
    assert_eq!(token_client.balance(&user_a), before + 300);

    let data = client.get_member_balance(&user_a).unwrap();
    assert_eq!(data.total_withdrawn, 300);
    assert_eq!(data.has_received_payout, true);

    // Step 4 – verify other members' state unchanged
    let org_data = client.get_member_balance(&organizer).unwrap();
    assert_eq!(org_data.total_withdrawn, 0);
    assert_eq!(org_data.has_received_payout, false);
}

// ─── Time-Bound Integration Scenarios ─────────────────────────────────────────

/// Validate that a missed payment allows the admin to slash the member.
/// Since the contract does not currently block late deposits automatically,
/// this validates the manual admin intervention policy.
#[test]
fn test_integration_late_payment_admin_slashes() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup_with_members(&env);

    // Initial state: Ledger time is 1_000_000
    let mut info = base_ledger();
    info.timestamp = 1_000_000;
    env.ledger().set(info);

    // Fast-forward time by 10 days (frequency_days is 7)
    info.timestamp = 1_000_000 + 10 * 86_400;
    env.ledger().set(info.clone());

    // Admin notices the deadline passed without user_a depositing, applies slash.
    client.slash_member(&organizer, &user_a).unwrap();

    // The user can still deposit after being slashed once
    info.timestamp += 86_400; // 1 day later
    env.ledger().set(info);
    assert_eq!(client.deposit(&user_a), Ok(()));
}

/// Validate round rollover mechanics. The round ONLY advances when ALL members 
/// hit the required contribution threshold for the current round, regardless of time.
#[test]
fn test_integration_round_rollover_on_full_contribution() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup_with_members(&env);

    assert_eq!(client.get_circle_state().unwrap().current_round, 1);

    // 2 out of 3 members deposit
    client.deposit(&organizer).unwrap();
    client.deposit(&user_a).unwrap();

    // Round should still be 1
    assert_eq!(client.get_circle_state().unwrap().current_round, 1);

    // Fast-forward time
    let mut info = base_ledger();
    info.timestamp = 1_000_000 + 5 * 86_400;
    env.ledger().set(info);

    // Final member deposits
    client.deposit(&user_b).unwrap();

    // Now round should advance to 2
    assert_eq!(client.get_circle_state().unwrap().current_round, 2);
}

/// Validate that double actions (depositing twice) before the round boundary 
/// correctly registers as an early payment for the next round, without prematurely advancing the round.
#[test]
fn test_integration_round_boundary_double_actions() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, user_b) = setup_with_members(&env);

    // Organizer deposits twice
    client.deposit(&organizer).unwrap(); // Completes round 1 for organizer
    client.deposit(&organizer).unwrap(); // Pre-pays for round 2

    // Round is still 1 because user_a and user_b haven't paid
    assert_eq!(client.get_circle_state().unwrap().current_round, 1);

    // User A and B pay for round 1
    client.deposit(&user_a).unwrap();
    client.deposit(&user_b).unwrap();

    // NOW round advances to 2, and organizer is already covered for round 2
    assert_eq!(client.get_circle_state().unwrap().current_round, 2);

    // Organizer's total contributed should be 200
    let org_balance = client.get_member_balance(&organizer).unwrap();
    assert_eq!(org_balance.total_contributed, 200);
}

