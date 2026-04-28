#![cfg(test)]

//! Tests for emergency pause functionality (issue #663).
//!
//! Verifies that every state-changing public function returns `AjoError::Paused`
//! when the contract is in the `Panicked` (paused) state, and that the pause /
//! resume controls themselves are unaffected by the flag.

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    testutils::Address as _,
    token, Address, BytesN, Env, Symbol,
};

// ─── Shared fixture ───────────────────────────────────────────────────────────

fn setup(env: &Env) -> (AjoCircleClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let organizer = Address::generate(env);
    let admin = Address::generate(env);
    let member = Address::generate(env);
    let token = env.register_stellar_asset_contract(admin.clone());
    let token_admin = token::StellarAssetClient::new(env, &token);
    token_admin.mint(&organizer, &100_000_i128);
    token_admin.mint(&member, &100_000_i128);

    // contribution_amount=1_000_000, frequency_days=7, max_rounds=5, max_members=5
    client.initialize_circle(&organizer, &token, &1_000_000_i128, &7_u32, &5_u32, &5_u32);
    client.add_member(&organizer, &member);

    (client, organizer, member, token)
}

// ─── Pause / resume controls work regardless of pause state ──────────────────

#[test]
fn panic_and_resume_succeed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    assert_eq!(client.panic(&organizer), Ok(()));
    assert_eq!(client.resume(&organizer), Ok(()));
}

#[test]
fn emergency_stop_and_resume_operations_succeed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    assert_eq!(client.emergency_stop(&organizer), Ok(()));
    assert_eq!(client.resume_operations(&organizer), Ok(()));
}

// ─── contribute ──────────────────────────────────────────────────────────────

#[test]
fn contribute_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.contribute(&member, &1_000_000_i128), Err(AjoError::Paused));
}

#[test]
fn contribute_works_after_resume() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    client.resume(&organizer);
    assert_eq!(client.contribute(&member, &1_000_000_i128), Ok(()));
}

// ─── deposit ─────────────────────────────────────────────────────────────────

#[test]
fn deposit_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.deposit(&member), Err(AjoError::Paused));
}

// ─── join_circle / add_member ─────────────────────────────────────────────────

#[test]
fn join_circle_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let new_member = Address::generate(&env);

    client.panic(&organizer);
    assert_eq!(client.join_circle(&organizer, &new_member), Err(AjoError::Paused));
}

// ─── set_beneficiaries ───────────────────────────────────────────────────────

#[test]
fn set_beneficiaries_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    let beneficiaries = soroban_sdk::Vec::new(&env);
    assert_eq!(client.set_beneficiaries(&member, &beneficiaries), Err(AjoError::Paused));
}

// ─── remove_member ───────────────────────────────────────────────────────────

#[test]
fn remove_member_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.remove_member(&organizer, &member), Err(AjoError::Paused));
}

// ─── claim_payout / withdraw ─────────────────────────────────────────────────

#[test]
fn claim_payout_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.claim_payout(&member, &1_u32), Err(AjoError::Paused));
}

// ─── partial_withdraw ────────────────────────────────────────────────────────

#[test]
fn partial_withdraw_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    // Make a contribution first so there is something to withdraw
    client.contribute(&member, &1_000_000_i128);

    client.panic(&organizer);
    assert_eq!(client.partial_withdraw(&member), Err(AjoError::Paused));
}

// ─── start_dissolution_vote ──────────────────────────────────────────────────

#[test]
fn start_dissolution_vote_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.start_dissolution_vote(&organizer, &0_u32), Err(AjoError::Paused));
}

// ─── vote_to_dissolve ────────────────────────────────────────────────────────

#[test]
fn vote_to_dissolve_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.vote_to_dissolve(&member), Err(AjoError::Paused));
}

// ─── slash_member ────────────────────────────────────────────────────────────

#[test]
fn slash_member_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.slash_member(&organizer, &member), Err(AjoError::Paused));
}

// ─── set_kyc_status ──────────────────────────────────────────────────────────

#[test]
fn set_kyc_status_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.set_kyc_status(&organizer, &member, &true), Err(AjoError::Paused));
}

// ─── boot_dormant_member ─────────────────────────────────────────────────────

#[test]
fn boot_dormant_member_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    // Slash 3 times to make member dormant
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    client.panic(&organizer);
    assert_eq!(client.boot_dormant_member(&organizer, &member), Err(AjoError::Paused));
}

// ─── set_fee_config ──────────────────────────────────────────────────────────

#[test]
fn set_fee_config_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let treasury = Address::generate(&env);

    client.panic(&organizer);
    assert_eq!(client.set_fee_config(&organizer, &treasury, &100_u32), Err(AjoError::Paused));
}

// ─── set_yield_source ────────────────────────────────────────────────────────

#[test]
fn set_yield_source_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let yield_source = Address::generate(&env);

    client.panic(&organizer);
    assert_eq!(client.set_yield_source(&organizer, &yield_source), Err(AjoError::Paused));
}

// ─── toggle_staking ──────────────────────────────────────────────────────────

#[test]
fn toggle_staking_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.toggle_staking(&organizer, &true), Err(AjoError::Paused));
}

// ─── stake_funds ─────────────────────────────────────────────────────────────

#[test]
fn stake_funds_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.stake_funds(&organizer, &1_000_000_i128), Err(AjoError::Paused));
}

// ─── unstake_funds ───────────────────────────────────────────────────────────

#[test]
fn unstake_funds_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.unstake_funds(&organizer, &1_000_000_i128), Err(AjoError::Paused));
}

// ─── propose_upgrade ─────────────────────────────────────────────────────────

#[test]
fn propose_upgrade_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let hash = BytesN::from_array(&env, &[0u8; 32]);

    client.panic(&organizer);
    assert_eq!(client.propose_upgrade(&organizer, &hash), Err(AjoError::Paused));
}

// ─── execute_upgrade ─────────────────────────────────────────────────────────

#[test]
fn execute_upgrade_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.execute_upgrade(&organizer), Err(AjoError::Paused));
}

// ─── grant_role ──────────────────────────────────────────────────────────────

#[test]
fn grant_role_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let new_admin = Address::generate(&env);

    client.panic(&organizer);
    assert_eq!(
        client.grant_role(&organizer, &Symbol::new(&env, "ADMIN"), &new_admin),
        Err(AjoError::Paused)
    );
}

// ─── revoke_role ─────────────────────────────────────────────────────────────

#[test]
fn revoke_role_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);
    let new_admin = Address::generate(&env);

    // Grant first (while unpaused), then pause, then try to revoke
    client.grant_role(&organizer, &Symbol::new(&env, "ADMIN"), &new_admin);
    client.panic(&organizer);
    assert_eq!(
        client.revoke_role(&organizer, &Symbol::new(&env, "ADMIN"), &new_admin),
        Err(AjoError::Paused)
    );
}

// ─── emergency_refund is allowed while paused ────────────────────────────────

#[test]
fn emergency_refund_works_while_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, member, _) = setup(&env);

    client.contribute(&member, &1_000_000_i128);
    client.panic(&organizer);

    // emergency_refund is the escape hatch — must succeed when paused
    assert!(client.emergency_refund(&member).is_ok());
}

// ─── shuffle_rotation ────────────────────────────────────────────────────────

#[test]
fn shuffle_rotation_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer, _, _) = setup(&env);

    client.panic(&organizer);
    assert_eq!(client.shuffle_rotation(&organizer), Err(AjoError::Paused));
}
