#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
};

#[test]
fn test_initialize_with_zero_contribution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.try_initialize_circle(
        &organizer,
        &token,
        &0, // Invalid: zero contribution
        &7,
        &10,
        &5,
    );

    assert_eq!(result, Err(Ok(AjoError::InvalidInput)));
}

#[test]
fn test_initialize_with_negative_contribution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.try_initialize_circle(
        &organizer,
        &token,
        &-1000000, // Invalid: negative contribution
        &7,
        &10,
        &5,
    );

    assert_eq!(result, Err(Ok(AjoError::InvalidInput)));
}

#[test]
fn test_initialize_with_single_member() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.try_initialize_circle(
        &organizer,
        &token,
        &1000000,
        &7,
        &10,
        &1, // Invalid: members < 2
    );

    assert_eq!(result, Err(Ok(AjoError::InvalidInput)));
}

#[test]
fn test_initialize_with_valid_parameters() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    let result = client.try_initialize_circle(
        &organizer,
        &token,
        &1000000,
        &7,
        &10,
        &5, // Valid
    );

    assert!(result.is_ok());
}
