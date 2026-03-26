//! # Ajo Circle Smart Contract
//! Decentralized ROSCA implementation on Stellar (Soroban)

#![no_std]

pub mod factory;

#[cfg(test)]
mod deposit_tests;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, token, Address, Env, Map, Vec, Symbol
};

const MAX_MEMBERS: u32 = 50;
const HARD_CAP: u32 = 100;

// ---------------- ADMIN ROLE (simple AccessControl style) ----------------
const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AjoError {
    NotFound = 1,
    Unauthorized = 2,
    AlreadyExists = 3,
    InvalidInput = 4,
    AlreadyPaid = 5,
    InsufficientFunds = 6,
    Disqualified = 7,
    VoteAlreadyActive = 8,
    NoActiveVote = 9,
    AlreadyVoted = 10,
    CircleNotActive = 11,
    CircleAlreadyDissolved = 12,
    CircleAtCapacity = 13,
    CirclePanicked = 14,
    PriceUnavailable = 15,
    ArithmeticOverflow = 16,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleData {
    pub organizer: Address,
    pub token_address: Address,
    pub contribution_amount: i128,
    pub frequency_days: u32,
    pub max_rounds: u32,
    pub current_round: u32,
    pub member_count: u32,
    pub max_members: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberData {
    pub address: Address,
    pub total_contributed: i128,
    pub total_withdrawn: i128,
    pub has_received_payout: bool,
    pub status: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberStanding {
    pub missed_count: u32,
    pub is_active: bool,
}

#[contracttype]
pub enum DataKey {
    Circle,
    Members,
    Standings,
    Admin,
    KycStatus,
    CircleStatus,
    RotationOrder,
    RoundDeadline,
    RoundContribCount,
    TotalPool,
    LastDepositAt,
    CycleWithdrawals,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {

    // ---------------- ADMIN CHECK ----------------
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AjoError> {
        caller.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AjoError::Unauthorized)?;

        if stored_admin != *caller {
            return Err(AjoError::Unauthorized);
        }
        Ok(())
    }

    // ---------------- INIT ----------------
    pub fn initialize_circle(
        env: Env,
        organizer: Address,
        token_address: Address,
        contribution_amount: i128,
        frequency_days: u32,
        max_rounds: u32,
        max_members: u32,
    ) -> Result<(), AjoError> {

        organizer.require_auth();
        let configured_max_members = if max_members == 0 { MAX_MEMBERS } else { max_members };

        env.storage().instance().set(&DataKey::Admin, &organizer);

        let configured_max_members = if max_members == 0 {
            MAX_MEMBERS
        } else {
            max_members
        };

        if contribution_amount <= 0
            || frequency_days == 0
            || max_rounds == 0
            || configured_max_members > HARD_CAP
        {
            return Err(AjoError::InvalidInput);
        }

        let circle_data = CircleData {
            organizer: organizer.clone(),
            token_address,
            contribution_amount,
            frequency_days,
            max_rounds,
            current_round: 1,
            member_count: 1,
            max_members: configured_max_members,
        };

        env.storage().instance().set(&DataKey::Circle, &circle_data);
        env.storage().instance().set(&DataKey::RoundContribCount, &0_u32);

        let deadline = env.ledger().timestamp() + (frequency_days as u64) * 86_400;
        env.storage().instance().set(&DataKey::RoundDeadline, &deadline);

        let mut members: Map<Address, MemberData> = Map::new(&env);
        members.set(
            organizer.clone(),
            MemberData {
                address: organizer.clone(),
                total_contributed: 0,
                total_withdrawn: 0,
                has_received_payout: false,
                status: 0,
            },
        );
        env.storage().instance().set(&DataKey::Members, &members);

        let mut standings: Map<Address, MemberStanding> = Map::new(&env);
        standings.set(organizer.clone(), MemberStanding { missed_count: 0, is_active: true });
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    // ---------------- JOIN ----------------
    pub fn join_circle(
        env: Env,
        organizer: Address,
        new_member: Address,
    ) -> Result<(), AjoError> {

        organizer.require_auth();

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if members.contains_key(new_member.clone()) {
            return Err(AjoError::AlreadyExists);
        }

        if circle.member_count >= circle.max_members {
            return Err(AjoError::CircleAtCapacity);
        }

        members.set(new_member.clone(), MemberData {
            address: new_member.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        });

        circle.member_count += 1;

        env.storage().instance().set(&DataKey::Circle, &circle);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(())
    }

    // ---------------- CONTRIBUTION ----------------
    pub fn contribute(
        env: Env,
        member: Address,
        amount: i128,
    ) -> Result<(), AjoError> {

        member.require_auth();

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members
            .get(member.clone())
            .ok_or(AjoError::NotFound)?;

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        member_data.total_contributed += amount;
        members.set(member, member_data);

        env.storage().instance().set(&DataKey::Members, &members);

        Ok(())
    }

    // ---------------- ADMIN FUNCTIONS ----------------

    pub fn set_kyc_status(
        env: Env,
        admin: Address,
        member: Address,
        is_verified: bool,
    ) -> Result<(), AjoError> {

        Self::require_admin(&env, &admin)?;
        let mut kyc: Map<Address, bool> = env.storage().instance().get(&DataKey::KycStatus).unwrap_or_else(|| Map::new(&env));
        kyc.set(member, is_verified);
        env.storage().instance().set(&DataKey::KycStatus, &kyc);
        Ok(())
    }

    pub fn boot_dormant_member(
        env: Env,
        admin: Address,
        member: Address,
    ) -> Result<(), AjoError> {

        Self::require_admin(&env, &admin)?;

        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        let mut standing = standings
            .get(member.clone())
            .ok_or(AjoError::NotFound)?;

        standing.is_active = false;

        standings.set(member.clone(), standing);
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    pub fn shuffle_rotation(env: Env, admin: Address) -> Result<(), AjoError> {

        Self::require_admin(&env, &admin)?;

        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut rotation: Vec<Address> = Vec::new(&env);

        for (addr, _) in members.iter() {
            rotation.push_back(addr);
        }

        env.storage().instance().set(&DataKey::RotationOrder, &rotation);

        Ok(())
    }

    // ---------------- PAYOUT ----------------
    pub fn claim_payout(
        env: Env,
        member: Address,
        _cycle: u32,
    ) -> Result<i128, AjoError> {

        member.require_auth();

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members
            .get(member.clone())
            .ok_or(AjoError::NotFound)?;

        let payout = (circle.member_count as i128) * circle.contribution_amount;

        member_data.total_withdrawn += payout;
        member_data.has_received_payout = true;

        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &payout);

        Ok(payout)
    }
}
