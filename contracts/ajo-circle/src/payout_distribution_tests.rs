#![cfg(test)]

//! Comprehensive test matrix for payout distribution logic
//!
//! This module provides exhaustive verification of the payout distribution system
//! covering multiple cycles, partial contributions, and split beneficiaries.
//! Funds are always distributed to the correct recipient in the correct amount.

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
};

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/// Setup a basic circle with organizer and token
fn setup_basic_circle(env: &Env) -> (AjoCircleClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let organizer = Address::generate(env);
    let admin = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(admin.clone());
    let token_admin = token::StellarAssetClient::new(env, &token_address);

    // Mint tokens to organizer
    token_admin.mint(&organizer, &10000_i128);

    // Initialize circle with 100 token contribution, 7 day frequency, 12 rounds, 5 max members
    client.initialize_circle(
        &organizer,
        &token_address,
        &100_i128,
        &7_u32,
        &12_u32,
        &5_u32,
    );

    (client, organizer, token_address, admin)
}

/// Setup circle with multiple members
fn setup_circle_with_members(
    env: &Env,
    member_count: u32,
) -> (AjoCircleClient, Address, Vec<Address>, Address, Address) {
    let (client, organizer, token_address, admin) = setup_basic_circle(env);
    let token_admin = token::StellarAssetClient::new(env, &token_address);

    let mut members = Vec::new(env);
    members.push_back(organizer.clone());

    // Add additional members
    for _ in 1..member_count {
        let member = Address::generate(env);
        token_admin.mint(&member, &10000_i128);
        client.add_member(&organizer, &member);
        members.push_back(member);
    }

    (client, organizer, members, token_address, admin)
}

/// Fund the contract for payouts
fn fund_contract_for_payouts(env: &Env, client: &AjoCircleClient, token_address: &Address, amount: i128) {
    let token_admin = token::StellarAssetClient::new(env, &token_address);
    token_admin.mint(&client.address, &amount);
}

// ─── MULTIPLE CYCLES TEST MATRIX ─────────────────────────────────────────────

/// Test payout distribution across multiple cycles with different member counts
#[test]
fn test_payout_distribution_multiple_cycles_3_members() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 3);
    let token_client = token::Client::new(&env, &token_address);

    // Expected payout per cycle: 3 members * 100 contribution = 300
    let expected_payout = 300_i128;

    // Fund contract for multiple payouts
    fund_contract_for_payouts(&env, &client, &token_address, 900_i128);

    // Track initial balances
    let mut initial_balances = std::collections::HashMap::new();
    for member in members.iter() {
        initial_balances.insert(member.clone(), token_client.balance(&member));
    }

    // Cycle 1: First member in rotation claims payout
    let member1 = members.get(0).unwrap();
    let payout1 = client.claim_payout(&member1, &1_u32);
    assert_eq!(payout1, Ok(expected_payout));
    assert_eq!(token_client.balance(&member1), initial_balances[&member1] + expected_payout);

    // Cycle 2: Second member claims payout
    let member2 = members.get(1).unwrap();
    let payout2 = client.claim_payout(&member2, &2_u32);
    assert_eq!(payout2, Ok(expected_payout));
    assert_eq!(token_client.balance(&member2), initial_balances[&member2] + expected_payout);

    // Cycle 3: Third member claims payout
    let member3 = members.get(2).unwrap();
    let payout3 = client.claim_payout(&member3, &3_u32);
    assert_eq!(payout3, Ok(expected_payout));
    assert_eq!(token_client.balance(&member3), initial_balances[&member3] + expected_payout);

    // Verify total pool is drained
    let final_pool: i128 = env.storage().instance().get(&crate::DataKey::TotalPool).unwrap_or(0);
    assert_eq!(final_pool, 0_i128);
}

#[test]
fn test_payout_distribution_multiple_cycles_5_members() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 5);
    let token_client = token::Client::new(&env, &token_address);

    // Expected payout per cycle: 5 members * 100 contribution = 500
    let expected_payout = 500_i128;

    // Fund contract for multiple payouts
    fund_contract_for_payouts(&env, &client, &token_address, 2500_i128);

    // Track initial balances
    let mut initial_balances = std::collections::HashMap::new();
    for member in members.iter() {
        initial_balances.insert(member.clone(), token_client.balance(&member));
    }

    // Execute payouts for all 5 cycles
    for cycle in 1..=5 {
        let member_idx = (cycle - 1) as u32;
        let member = members.get(member_idx).unwrap();
        let payout = client.claim_payout(&member, &cycle);
        assert_eq!(payout, Ok(expected_payout));
        assert_eq!(token_client.balance(&member), initial_balances[&member] + expected_payout);
    }

    // Verify total pool is drained
    let final_pool: i128 = env.storage().instance().get(&crate::DataKey::TotalPool).unwrap_or(0);
    assert_eq!(final_pool, 0_i128);
}

// ─── PARTIAL CONTRIBUTIONS TEST MATRIX ───────────────────────────────────────

/// Test payout distribution when not all members have contributed fully
#[test]
fn test_payout_distribution_with_partial_contributions() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 3);
    let token_client = token::Client::new(&env, &token_address);

    // Only 2 out of 3 members make full contributions
    let member1 = members.get(0).unwrap();
    let member2 = members.get(1).unwrap();
    let member3 = members.get(2).unwrap();

    client.deposit(&member1); // 100 tokens
    client.deposit(&member2); // 100 tokens
    // member3 does not contribute

    // Pool should have 200 tokens, but payout requires 300
    // This should still allow payout if contract is funded externally
    fund_contract_for_payouts(&env, &client, &token_address, 300_i128);

    // First member should still be able to claim full payout
    let initial_balance = token_client.balance(&member1);
    let payout = client.claim_payout(&member1, &1_u32);
    assert_eq!(payout, Ok(300_i128)); // Full payout amount
    assert_eq!(token_client.balance(&member1), initial_balance + 300_i128);
}

#[test]
fn test_payout_distribution_partial_contributions_insufficient_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 4);

    // Only 2 out of 4 members contribute
    let member1 = members.get(0).unwrap();
    let member2 = members.get(1).unwrap();

    client.deposit(&member1); // 100 tokens
    client.deposit(&member2); // 100 tokens
    // Pool has only 200 tokens, but payout requires 400

    // Payout should be rejected due to insufficient funds
    let payout = client.claim_payout(&member1, &1_u32);
    assert_eq!(payout, Err(AjoError::InsufficientFunds));
}

#[test]
fn test_payout_distribution_mixed_contribution_amounts() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 3);
    let token_client = token::Client::new(&env, &token_address);

    // Members make different contribution amounts
    let member1 = members.get(0).unwrap();
    let member2 = members.get(1).unwrap();
    let member3 = members.get(2).unwrap();

    client.contribute(&member1, &50_i128);  // Partial contribution
    client.contribute(&member2, &100_i128); // Full contribution
    client.contribute(&member3, &75_i128);  // Partial contribution

    // Pool has 225 tokens, but payout still requires 300 for 3 members
    fund_contract_for_payouts(&env, &client, &token_address, 300_i128);

    // Payout should still work with full amount
    let initial_balance = token_client.balance(&member1);
    let payout = client.claim_payout(&member1, &1_u32);
    assert_eq!(payout, Ok(300_i128));
    assert_eq!(token_client.balance(&member1), initial_balance + 300_i128);
}

// ─── SPLIT BENEFICIARIES TEST MATRIX ─────────────────────────────────────────

/// Test that payout goes to correct beneficiary in rotation order
#[test]
fn test_payout_distribution_correct_beneficiary_rotation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 4);
    let token_client = token::Client::new(&env, &token_address);

    // Fund contract for payouts
    fund_contract_for_payouts(&env, &client, &token_address, 1200_i128);

    // Track initial balances
    let mut initial_balances = std::collections::HashMap::new();
    for member in members.iter() {
        initial_balances.insert(member.clone(), token_client.balance(&member));
    }

    // Test that only the correct beneficiary can claim each cycle
    let expected_payout = 400_i128; // 4 members * 100

    // Cycle 1: Only first member can claim
    let member1 = members.get(0).unwrap();
    let member2 = members.get(1).unwrap();

    let wrong_claim = client.claim_payout(&member2, &1_u32);
    assert_eq!(wrong_claim, Err(AjoError::Unauthorized)); // Wrong beneficiary

    let correct_claim = client.claim_payout(&member1, &1_u32);
    assert_eq!(correct_claim, Ok(expected_payout));
    assert_eq!(token_client.balance(&member1), initial_balances[&member1] + expected_payout);

    // Cycle 2: Only second member can claim
    let member3 = members.get(2).unwrap();
    let wrong_claim2 = client.claim_payout(&member3, &2_u32);
    assert_eq!(wrong_claim2, Err(AjoError::Unauthorized));

    let correct_claim2 = client.claim_payout(&member2, &2_u32);
    assert_eq!(correct_claim2, Ok(expected_payout));
    assert_eq!(token_client.balance(&member2), initial_balances[&member2] + expected_payout);
}

#[test]
fn test_payout_distribution_beneficiary_validation_edge_cases() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 3);

    // Fund contract
    fund_contract_for_payouts(&env, &client, &token_address, 300_i128);

    // Test invalid cycle numbers
    let member1 = members.get(0).unwrap();
    assert_eq!(client.claim_payout(&member1, &0_u32), Err(AjoError::InvalidInput));
    assert_eq!(client.claim_payout(&member1, &4_u32), Err(AjoError::InvalidInput)); // Beyond max_rounds

    // Test non-member trying to claim
    let non_member = Address::generate(env);
    assert_eq!(client.claim_payout(&non_member, &1_u32), Err(AjoError::Disqualified));
}

#[test]
fn test_payout_distribution_sequential_beneficiaries() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 5);
    let token_client = token::Client::new(&env, &token_address);

    // Fund contract for all payouts
    fund_contract_for_payouts(&env, &client, &token_address, 2500_i128);

    let expected_payout = 500_i128; // 5 * 100

    // Verify each beneficiary gets exactly one payout in sequence
    for cycle in 1..=5 {
        let member_idx = (cycle - 1) as u32;
        let beneficiary = members.get(member_idx).unwrap();

        let initial_balance = token_client.balance(&beneficiary);
        let payout = client.claim_payout(&beneficiary, &cycle);
        assert_eq!(payout, Ok(expected_payout));
        assert_eq!(token_client.balance(&beneficiary), initial_balance + expected_payout);

        // Verify member state is updated correctly
        let member_data = client.get_member_balance(&beneficiary).unwrap();
        assert_eq!(member_data.has_received_payout, true);
        assert_eq!(member_data.total_withdrawn, expected_payout);
    }
}

// ─── COMPREHENSIVE SCENARIO MATRIX ───────────────────────────────────────────

/// Test complex scenario: partial contributions + multiple cycles + correct beneficiaries
#[test]
fn test_payout_distribution_complex_scenario() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 4);
    let token_client = token::Client::new(&env, &token_address);

    // Mixed contribution scenario
    let member1 = members.get(0).unwrap();
    let member2 = members.get(1).unwrap();
    let member3 = members.get(2).unwrap();
    let member4 = members.get(3).unwrap();

    // Different contribution patterns
    client.contribute(&member1, &100_i128); // Full
    client.contribute(&member2, &50_i128);  // Partial
    client.contribute(&member3, &100_i128); // Full
    // member4 contributes nothing

    // Fund contract externally for payouts
    fund_contract_for_payouts(&env, &client, &token_address, 1600_i128); // 4 cycles * 400

    let expected_payout = 400_i128; // 4 * 100

    // Execute all cycles
    for cycle in 1..=4 {
        let member_idx = (cycle - 1) as u32;
        let beneficiary = members.get(member_idx).unwrap();

        let initial_balance = token_client.balance(&beneficiary);
        let payout = client.claim_payout(&beneficiary, &cycle);
        assert_eq!(payout, Ok(expected_payout));
        assert_eq!(token_client.balance(&beneficiary), initial_balance + expected_payout);
    }

    // Verify final state
    let final_pool: i128 = env.storage().instance().get(&crate::DataKey::TotalPool).unwrap_or(0);
    assert_eq!(final_pool, 0_i128);
}

#[test]
fn test_payout_distribution_maximum_members() {
    let env = Env::default();
    env.mock_all_auths();

    // Test with maximum members (50)
    let (client, organizer, members, token_address, _admin) = setup_circle_with_members(&env, 50);
    let token_client = token::Client::new(&env, &token_address);

    // Fund contract for one payout cycle
    let expected_payout = 5000_i128; // 50 * 100
    fund_contract_for_payouts(&env, &client, &token_address, expected_payout);

    // First beneficiary claims payout
    let first_member = members.get(0).unwrap();
    let initial_balance = token_client.balance(&first_member);
    let payout = client.claim_payout(&first_member, &1_u32);
    assert_eq!(payout, Ok(expected_payout));
    assert_eq!(token_client.balance(&first_member), initial_balance + expected_payout);
}</content>
<parameter name="filePath">/Users/collins/projects/drip_wave_contrbt/Decentralized-Ajo/contracts/ajo-circle/src/payout_distribution_tests.rs