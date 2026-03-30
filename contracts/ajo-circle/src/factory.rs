#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};

use crate::{AjoCircleClient, AjoError};

#[contracttype]
pub enum FactoryDataKey {
    Registry,
}

#[contract]
pub struct AjoFactory;

#[contractimpl]
impl AjoFactory {
    pub fn create_ajo(
        env: Env,
        organizer: Address,
        ajo_wasm_hash: BytesN<32>,
        token_address: Address,
        contribution_amount: i128,
        frequency_days: u32,
        max_rounds: u32,
        max_members: u32,
    ) -> Result<Address, AjoError> {
        organizer.require_auth();

        let mut registry: Vec<Address> = env
            .storage()
            .instance()
            .get(&FactoryDataKey::Registry)
            .unwrap_or_else(|| Vec::new(&env));

        let registry_len = registry.len();
        let mut salt_bytes = [0u8; 32];
        let len_bytes = registry_len.to_be_bytes();
        let start = 32 - len_bytes.len();

        let mut i = 0;
        while i < len_bytes.len() {
            salt_bytes[start + i] = len_bytes[i];
            i += 1;
        }

        let salt = BytesN::from_array(&env, &salt_bytes);

        // Soroban deployment by wasm hash acts as the cost-efficient, reusable deploy path.
        let ajo_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy(ajo_wasm_hash);

        let ajo_client = AjoCircleClient::new(&env, &ajo_address);
        ajo_client.initialize_circle(
            &organizer,
            &token_address,
            &contribution_amount,
            &frequency_days,
            &max_rounds,
            &max_members,
        );

        registry.push_back(ajo_address.clone());
        env.storage()
            .instance()
            .set(&FactoryDataKey::Registry, &registry);

        Ok(ajo_address)
    }

    pub fn get_registry(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&FactoryDataKey::Registry)
            .unwrap_or_else(|| Vec::new(&env))
    }
}
