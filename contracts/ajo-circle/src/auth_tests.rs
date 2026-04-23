use super::*; // Re-export all from lib.rs

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_organizer_cannot_join_circle() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, organizer, user_a, _b) = setup(&env, 100, 5);
    let impostor = Address::generate(&env);

    impostor.require_auth();
    client.join_circle(&impostor, &user_a);
}

#[test]
#[should_panic(expected = "NotFound")]
fn test_non_member_cannot_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    stranger.require_auth();
    client.deposit(&stranger);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_panic() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, user_a, _b) = setup(&env, 100, 5);

    user_a.require_auth();
    client.panic(&user_a);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_deployer_cannot_grant_role() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, user_a, user_b) = setup(&env, 100, 5);
    let role = symbol_short!("MANAGER");

    user_a.require_auth();
    client.grant_role(&user_a, &role, &user_b);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_set_kyc_status() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, user_a, user_b) = setup(&env, 100, 5);

    user_a.require_auth();
    client.set_kyc_status(&user_a, &user_b, &true);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_slash_member() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, user_a, user_b) = setup(&env, 100, 5);

    user_a.require_auth();
    client.slash_member(&user_a, &user_b);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_organizer_cannot_shuffle_rotation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, user_a, _b) = setup_with_members(&env);

    user_a.require_auth();
    client.shuffle_rotation(&user_a);
}

#[test]
#[should_panic(expected = "NotFound")]
fn test_non_member_cannot_claim_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _tok, _org, _a, _b) = setup(&env, 100, 5);
    let stranger = Address::generate(&env);

    stranger.require_auth();
    client.claim_payout(&stranger, &1);
}

// CAPABILITY_MATRIX_COVERAGE: Negative tests for all privileged functions.

