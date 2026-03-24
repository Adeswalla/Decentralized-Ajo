#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_slash_and_disqualify() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member = Address::generate(&env);

    // Initialize circle
    client.initialize_circle(&organizer, &100_i128, &30_u32, &5_u32);
    
    // Add member
    client.add_member(&organizer, &member);

    // Organizer slashes member 3 times
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    // Member tries to contribute - should panic
    let res = client.try_contribute(&member, &100_i128);
    assert!(res.is_err());

    // Member tries to claim payout - should return Disqualified
    let res = client.try_claim_payout(&member);
    assert_eq!(res, Err(Ok(AjoError::Disqualified)));
}

#[test]
fn test_grace_period_reset() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member = Address::generate(&env);

    // Initialize circle
    client.initialize_circle(&organizer, &100_i128, &30_u32, &5_u32);
    
    // Add member
    client.add_member(&organizer, &member);

    // Organizer slashes member 2 times (less than 3)
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    // Member contributes; this should reset the missed_count to 0
    client.contribute(&member, &100_i128);

    // Organizer slashes member 2 more times 
    // Total slashes on member = 4, but since it was reset, current misses = 2
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    // Member contributes again to confirm they are not disqualified
    client.contribute(&member, &100_i128);

    // Claim payout successfully (no disqualification)
    let payout = client.claim_payout(&member);
    assert_eq!(payout, 200); // 2 members * 100
}
