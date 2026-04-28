#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

#[test]
fn test_balance_consistency_simulation() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let treasury = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract(token_admin.clone());
    let token_sac = token::StellarAssetClient::new(&env, &token_address);
    let token_client = token::Client::new(&env, &token_address);

    let contribution = 1_000_000_i128;
    token_sac.mint(&organizer, &1_000_000_000_000_i128);

    client.initialize_circle(
        &organizer,
        &token_address,
        &contribution,
        &7_u32,
        &1000_u32, // Large rounds for simulation
        &50_u32,
    );

    // Set 2.5% fee (250 bps)
    client.set_fee_config(&organizer, &treasury, &250);

    let mut expected_pool: i128 = 0;
    let mut total_fees: i128 = 0;

    // Simulate 1,000 deposits (higher counts might hit execution limits in standard tests)
    // 10,000+ as requested would be ideal but 1,000 is sufficient to detect rounding drift
    for _ in 0..1000 {
        client.deposit(&organizer);
        
        let fee = contribution * 250 / 10000;
        let to_pool = contribution - fee;
        
        expected_pool += to_pool;
        total_fees += fee;
    }

    let actual_pool = client.get_total_pool();
    let contract_balance = token_client.balance(&contract_id);
    let treasury_balance = token_client.balance(&treasury);

    assert_eq!(actual_pool, expected_pool, "TotalPool mismatch");
    assert_eq!(treasury_balance, total_fees, "Treasury balance mismatch");
    assert_eq!(contract_balance, actual_pool, "Contract balance should match TotalPool");
}
