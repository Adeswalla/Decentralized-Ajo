#![no_std]
use soroban_sdk::{contract, contractimpl, contracterror, contracttype, Address, Env};

/// Error variants returned by the FiatBridge contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    /// Returned when a caller is not authorized to perform the operation.
    Unauthorized = 1,
    /// Returned when an operation exceeds the configured global limit.
    LimitExceeded = 2,
    /// Returned when a withdrawal request exceeds available balances.
    InsufficientBalance = 3,
}

/// Storage keys for the FiatBridge contract state
#[contracttype]
pub enum DataKey {
    /// Used to store the admin's Address
    Admin,
    /// Used to store the token's Address
    Token,
    /// Used to store the global deposit/withdraw limit (i128)
    Limit,
    /// Used to safely track user balances: map of Address to i128
    Balance(Address),
    /// Used to store the aggregate deposited amount
    TotalDeposited,
}

#[contract]
pub struct FiatBridge;

#[contractimpl]
impl FiatBridge {
    /// Initializes the FiatBridge contract with an administrator and token address.
    /// 
    /// Authorization is required from the provided admin address.
    /// Can return no specific custom Error variants directly, but native Soroban sdk might panic on duplicate init.
    pub fn init(env: Env, admin: Address, token: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Limit, &i128::MAX);
        env.storage().instance().set(&DataKey::TotalDeposited, &0i128);
    }

    /// Deposits the specified token amount into a user's balance.
    /// 
    /// Caller must be the user making the deposit.
    /// Returns `Error::LimitExceeded` if the amount exceeds the global deposit limit.
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        user.require_auth();
        let limit: i128 = env.storage().instance().get(&DataKey::Limit).unwrap_or(i128::MAX);
        if amount > limit {
            return Err(Error::LimitExceeded);
        }
        let current_bal: i128 = env.storage().persistent().get(&DataKey::Balance(user.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(user), &(current_bal + amount));
        
        let total: i128 = env.storage().instance().get(&DataKey::TotalDeposited).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDeposited, &(total + amount));
        Ok(())
    }

    /// Withdraws a specified amount from the user's balance.
    /// 
    /// Caller must be the user making the withdrawal.
    /// Returns `Error::InsufficientBalance` if the requested amount exceeds the user's current balance.
    pub fn withdraw(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        user.require_auth();
        let current_bal: i128 = env.storage().persistent().get(&DataKey::Balance(user.clone())).unwrap_or(0);
        if amount > current_bal {
            return Err(Error::InsufficientBalance);
        }
        env.storage().persistent().set(&DataKey::Balance(user), &(current_bal - amount));
        
        let total: i128 = env.storage().instance().get(&DataKey::TotalDeposited).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDeposited, &(total - amount));
        Ok(())
    }

    /// Sets the maximum deposit limit permitted.
    /// 
    /// Caller must be the admin of the bridge.
    /// This function does not explicitly return any custom error variants but will panic if unauthorized.
    pub fn set_limit(env: Env, new_limit: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Limit, &new_limit);
    }

    /// Transfers bridge administration privileges to a new address.
    /// 
    /// Caller must be the current admin.
    /// This function doesn't return any custom error variants but will panic if unauthorized.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Retrieves the current admin address.
    /// 
    /// No authorization required.
    /// Does not return any custom error variants.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Retrieves the underlying token address assigned to the bridge.
    /// 
    /// No authorization required.
    /// Does not return any custom error variants.
    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    /// Retrieves the current global transaction limit.
    /// 
    /// No authorization required.
    /// Does not return any custom error variants.
    pub fn get_limit(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Limit).unwrap_or(i128::MAX)
    }

    /// Retrieves the balance for a specific user.
    /// 
    /// No authorization required.
    /// Does not return any custom error variants.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(user)).unwrap_or(0)
    }

    /// Retrieves the total aggregated deposit amounts in the bridge.
    /// 
    /// No authorization required.
    /// Does not return any custom error variants.
    pub fn get_total_deposited(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalDeposited).unwrap_or(0)
    }
}
