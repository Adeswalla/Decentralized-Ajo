#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, CircleData, MemberData};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

fn setup_test<'a>() -> (
    Env,
    AjoCircleClient<'a>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for all users
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let user_1 = Address::generate(&env);
    let user_2 = Address::generate(&env);
    let user_3 = Address::generate(&env);

    client.initialize_circle(&organizer, &100, &30, &3);

    (env, client, organizer, user_1, user_2, user_3)
}

#[test]
fn test_circle_lifecycle() {
    let (env, client, organizer, user_1, user_2, user_3) = setup_test();

    // Add members
    client.add_member(&organizer, &user_1);
    client.add_member(&organizer, &user_2);
    client.add_member(&organizer, &user_3);

    let circle_state = client.get_circle_state();
    assert_eq!(circle_state.member_count, 4); // Organizer + 3 members

    // 3 Contributions (actually 4 members including organizer)
    client.contribute(&organizer, &100);
    client.contribute(&user_1, &100);
    client.contribute(&user_2, &100);
    client.contribute(&user_3, &100);

    // Verify member balances
    let u1_bal = client.get_member_balance(&user_1);
    assert_eq!(u1_bal.total_contributed, 100);
    assert_eq!(u1_bal.total_withdrawn, 0);

    // 1 Payout for a member (e.g. user_1)
    let payout = client.claim_payout(&user_1);
    // There are 4 members and contribution is 100, so payout should be 400
    assert_eq!(payout, 400);

    let updated_u1_bal = client.get_member_balance(&user_1);
    assert_eq!(updated_u1_bal.total_withdrawn, 400);
    assert_eq!(updated_u1_bal.has_received_payout, true);
}

#[test]
#[should_panic(expected = "notmem")]
fn test_unauthorized_contribution() {
    let (env, client, _organizer, _user_1, _user_2, _user_3) = setup_test();

    let external_user = Address::generate(&env);
    // Attempt to contribute without being added
    client.contribute(&external_user, &100);
}

#[test]
#[should_panic(expected = "exists")]
fn test_duplicate_member_join() {
    let (_env, client, organizer, user_1, _user_2, _user_3) = setup_test();
    client.add_member(&organizer, &user_1);
    // Attempting to add the same member again should panic with 'exists'
    client.add_member(&organizer, &user_1);
}

#[test]
#[should_panic(expected = "alpaid")]
fn test_double_payout_claim() {
    let (_env, client, organizer, user_1, _user_2, _user_3) = setup_test();
    client.add_member(&organizer, &user_1);
    
    client.contribute(&organizer, &100);
    client.contribute(&user_1, &100);

    client.claim_payout(&user_1);
    // Cannot claim payout twice
    client.claim_payout(&user_1);
}

#[test]
#[should_panic(expected = "insufund")]
fn test_partial_withdraw_insufficient_funds() {
    let (_env, client, organizer, user_1, _user_2, _user_3) = setup_test();
    client.add_member(&organizer, &user_1);
    
    client.contribute(&user_1, &50);

    // User only has 50 contributed. Withdrawing 60 should fail.
    client.partial_withdraw(&user_1, &60);
}

#[test]
fn test_partial_withdraw_success() {
    let (_env, client, organizer, user_1, _user_2, _user_3) = setup_test();
    client.add_member(&organizer, &user_1);
    
    client.contribute(&user_1, &100);
    let net_amount = client.partial_withdraw(&user_1, &50);
    
    // 10% penalty on 50 is 5. Net should be 45.
    assert_eq!(net_amount, 45);

    let u1_bal = client.get_member_balance(&user_1);
    assert_eq!(u1_bal.total_contributed, 100);
    assert_eq!(u1_bal.total_withdrawn, 50); // Raw amount recorded
}

#[test]
fn test_future_deadline_enforcement_mock() {
    let (env, client, organizer, _user_1, _user_2, _user_3) = setup_test();
    
    let state = client.get_circle_state();
    assert_eq!(state.frequency_days, 30);
    
    // Simulate time passing (e.g. 30 days)
    // 30 days in seconds = 30 * 24 * 60 * 60 = 2592000 
    env.ledger().set_timestamp(env.ledger().timestamp() + 2592000);
    env.ledger().set_sequence_number(env.ledger().sequence() + 10000);
    
    // Even though the contract doesn't explicitly enforce timestamp for payouts yet,
    // this test demonstrates how to simulate ledger advancement for future implementations.
    let balance = client.get_member_balance(&organizer);
    assert_eq!(balance.status, 0); // Active
}

#[test]
#[should_panic(expected = "badamt")]
fn test_bad_amount_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);

    client.initialize_circle(&organizer, &0, &30, &3);
}

#[test]
#[should_panic(expected = "badfreq")]
fn test_bad_freq_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);

    client.initialize_circle(&organizer, &100, &0, &3);
}

#[test]
#[should_panic(expected = "badrnd")]
fn test_bad_rounds_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);

    client.initialize_circle(&organizer, &100, &30, &0);
}

#[test]
#[should_panic(expected = "badamt")]
fn test_contribute_bad_amount() {
    let (_env, client, organizer, _user_1, _user_2, _user_3) = setup_test();
    client.contribute(&organizer, &0);
}

#[test]
#[should_panic(expected = "badamt")]
fn test_withdraw_bad_amount() {
    let (_env, client, organizer, _user_1, _user_2, _user_3) = setup_test();
    client.partial_withdraw(&organizer, &0);
}

#[test]
#[should_panic(expected = "notauth")]
fn test_add_member_not_auth() {
    let (env, client, _organizer, user_1, user_2, _user_3) = setup_test();
    // User_1 tries to add user_2, but only the organizer can add members.
    // In soroban auth is usually abstracted or handled by `.require_auth()`
    // Here we just test the contract logic comparing caller to organizer.
    // To trigger the "notauth" logic, we pass a different address as `organizer`.
    client.add_member(&user_1, &user_2);
}

#[test]
fn test_get_members() {
    let (_env, client, organizer, user_1, user_2, _user_3) = setup_test();
    client.add_member(&organizer, &user_1);
    client.add_member(&organizer, &user_2);

    let members = client.get_members();
    assert_eq!(members.len(), 3); // Organizer + 2 members
}

#[test]
#[should_panic(expected = "nocircle")]
fn test_uninitialized_circle() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let user_1 = Address::generate(&env);

    client.get_circle_state(); // Should panic because it wasn't initialized
}

#[test]
#[should_panic(expected = "notmem")]
fn test_unauthorized_claim_payout() {
    let (env, client, _organizer, _user_1, _user_2, _user_3) = setup_test();

    let external_user = Address::generate(&env);
    // Attempt to claim layout without being a member
    client.claim_payout(&external_user);
}

#[test]
#[should_panic(expected = "notmem")]
fn test_get_unauthorized_balance() {
    let (env, client, _organizer, _user_1, _user_2, _user_3) = setup_test();

    let external_user = Address::generate(&env);
    // Target user balance should not be found if they aren't a member
    client.get_member_balance(&external_user);
}

