#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, AjoError};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
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
fn test_staking_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, token_address, organizer, _user_a, _user_b) = setup(&env, 1000, 5);
    let yield_source = Address::generate(&env);
    let token_sac = token::StellarAssetClient::new(&env, &token_address);
    let token_client = token::Client::new(&env, &token_address);

    // 1. Configure yield source
    client.set_yield_source(&organizer, &yield_source);
    
    // 2. Enable staking
    client.toggle_staking(&organizer, &true);

    // 3. Deposit some funds to the pool (normally via contribute/deposit)
    // For simplicity, we already minted to the contract in setup.
    // Let's check initial pool
    assert_eq!(client.get_total_pool(), 0); 
    // Wait, setup() calls initialize_circle but doesn't deposit. 
    // Let's deposit.
    client.deposit(&organizer, &10000);
    assert_eq!(client.get_total_pool(), 10000);

    // 4. Stake funds
    client.stake_funds(&organizer, &5000);
    assert_eq!(client.get_staked_amount(), 5000);
    assert_eq!(client.get_total_pool(), 5000);
    assert_eq!(token_client.balance(&yield_source), 5000);

    // 5. Unstake funds with interest
    // To simulate interest, we mint some extra tokens to the yield_source 
    // and then call unstake which transfers from yield_source back.
    token_sac.mint(&yield_source, &500); // 10% interest
    
    // Unstake 5000, should receive 5500 back
    client.unstake_funds(&organizer, &5000);
    
    assert_eq!(client.get_staked_amount(), 0);
    assert_eq!(client.get_total_interest(), 500);
    assert_eq!(client.get_total_pool(), 10500); // 5000 original + 5500 back
}

#[test]
fn test_payout_with_interest() {
    let env = Env::default();
    env.mock_all_auths();

    // Small circle for easy math: 2 members, 1000 contribution
    let (client, token_address, organizer, user_a, _user_b) = setup(&env, 1000, 2);
    let yield_source = Address::generate(&env);
    let token_sac = token::StellarAssetClient::new(&env, &token_address);
    let token_client = token::Client::new(&env, &token_address);

    client.join_circle(&organizer, &user_a);
    
    // Members contribute
    client.contribute(&organizer);
    client.contribute(&user_a);

    // Pool should be 2000
    assert_eq!(client.get_total_pool(), 2000);

    // Stake 1000
    client.set_yield_source(&organizer, &yield_source);
    client.toggle_staking(&organizer, &true);
    client.stake_funds(&organizer, &1000);
    
    // Simulate interest
    token_sac.mint(&yield_source, &200);
    client.unstake_funds(&organizer, &1000);

    // Total interest is 200. Max rounds is 12 (from setup).
    // interest_share = 200 / 12 = 16
    // Expected payout = 2000 + 16 = 2016
    
    let balance_before = token_client.balance(&organizer);
    client.claim_payout(&organizer);
    let balance_after = token_client.balance(&organizer);
    
    assert_eq!(balance_after - balance_before, 2016);
    assert_eq!(client.get_total_interest(), 200 - 16);
}
