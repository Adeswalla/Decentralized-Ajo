#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, AjoError, Beneficiary};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env, vec,
};

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

    for addr in [&organizer, &user_a, &user_b] {
        token_sac.mint(addr, &1_000_000_i128);
    }
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

#[test]
fn test_split_payout_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, user_a, _user_b) = setup(&env, 1000, 2);
    let token_client = token::Client::new(&env, &token_address);

    client.join_circle(&organizer, &user_a);
    
    // Member A wants to split their payout with two beneficiaries
    let beneficiary_1 = Address::generate(&env);
    let beneficiary_2 = Address::generate(&env);
    
    let beneficiaries = vec![&env, 
        Beneficiary { address: beneficiary_1.clone(), share_bps: 3000 }, // 30%
        Beneficiary { address: beneficiary_2.clone(), share_bps: 7000 }, // 70%
    ];
    
    client.set_beneficiaries(&user_a, &beneficiaries);

    // Members contribute to fill the pool
    client.contribute(&organizer);
    client.contribute(&user_a);

    // Pool should be 2000
    assert_eq!(client.get_total_pool(), 2000);

    // Rotation is typically organizer, user_a
    // Round 2 should be user_a
    client.claim_payout(&user_a, &2);
    
    // Payout should be 2000
    // Beneficiary 1 should get 2000 * 30% = 600
    // Beneficiary 2 should get 2000 * 70% = 1400
    
    assert_eq!(token_client.balance(&beneficiary_1), 600);
    assert_eq!(token_client.balance(&beneficiary_2), 1400);
    assert_eq!(token_client.balance(&user_a), 1000000 - 1000); // Only contributed, no payout to main address
}

#[test]
fn test_invalid_beneficiary_shares() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token_address, organizer, user_a, _user_b) = setup(&env, 1000, 2);
    client.join_circle(&organizer, &user_a);

    // Shares sum to 90% (9000 bps) - should fail
    let beneficiaries = vec![&env, 
        Beneficiary { address: Address::generate(&env), share_bps: 5000 },
        Beneficiary { address: Address::generate(&env), share_bps: 4000 },
    ];
    
    let result = client.try_set_beneficiaries(&user_a, &beneficiaries);
    assert!(result.is_err());
}

#[test]
fn test_clear_beneficiaries() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, user_a, _user_b) = setup(&env, 1000, 2);
    let token_client = token::Client::new(&env, &token_address);

    client.join_circle(&organizer, &user_a);
    
    let beneficiaries = vec![&env, 
        Beneficiary { address: Address::generate(&env), share_bps: 10000 },
    ];
    
    client.set_beneficiaries(&user_a, &beneficiaries);
    
    // Clear beneficiaries
    client.set_beneficiaries(&user_a, &vec![&env]);

    client.contribute(&organizer);
    client.contribute(&user_a);

    client.claim_payout(&user_a, &2);
    
    // Should go to user_a directly
    assert_eq!(token_client.balance(&user_a), 1000000 - 1000 + 2000);
}
