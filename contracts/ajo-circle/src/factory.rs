#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Vec};

use crate::{AjoCircleClient, AjoError};

#[contracttype]
pub enum FactoryDataKey {
    CircleCount,
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

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&FactoryDataKey::CircleCount)
            .unwrap_or(0);

        let registry_len = count;
        let mut salt_bytes = [0u8; 32];
        let len_bytes = registry_len.to_be_bytes();
        let start = 32_usize.checked_sub(len_bytes.len()).ok_or(AjoError::ArithmeticOverflow)?;

        let mut i = 0;
        while i < len_bytes.len() {
            let idx = start.checked_add(i).ok_or(AjoError::ArithmeticOverflow)?;
            salt_bytes[idx] = len_bytes[i];
            i = i.checked_add(1).ok_or(AjoError::ArithmeticOverflow)?;
        }

        let salt = BytesN::from_array(&env, &salt_bytes);

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

        count += 1;
        env.storage()
            .instance()
            .set(&FactoryDataKey::CircleCount, &count);

        // Record history via events instead of persistent state variables to reduce storage costs
        env.events().publish(
            (symbol_short!("factory"), symbol_short!("created")),
            (organizer, ajo_address.clone()),
        );

        Ok(ajo_address)
    }

    pub fn get_registry(env: Env) -> Vec<Address> {
        // Circle registry is now managed via event logs to minimize on-chain storage costs
        Vec::new(&env)
    }
}
