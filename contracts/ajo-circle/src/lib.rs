//! # Ajo Circle Smart Contract
//! Decentralized ROSCA implementation on Stellar (Soroban)

#![no_std]

pub mod factory;

#[cfg(test)]
mod deposit_tests;

#[cfg(test)]
mod withdrawal_tests;

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

        // Emit CircleCreated event
        env.events().publish(
            (symbol_short!("created"), organizer.clone()),
            (
                contribution_amount,
                configured_max_members,
                max_rounds,
                frequency_days,
                env.ledger().timestamp()
            )
        );

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

        // Add member to standings
        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));
        standings.set(new_member.clone(), MemberStanding { missed_count: 0, is_active: true });
        env.storage().instance().set(&DataKey::Standings, &standings);

        // Emit MemberJoined event
        env.events().publish(
            (symbol_short!("join"), new_member.clone()),
            (circle.member_count, env.ledger().timestamp())
        );

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

        // Enforce exact contribution amount — no partial or excess deposits
        if amount != circle.contribution_amount {
            return Err(AjoError::InvalidInput);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        // Only registered members may contribute
        let mut member_data = members
            .get(member.clone())
            .ok_or(AjoError::NotFound)?;

        // Block contributions once circle is full
        if circle.member_count >= circle.max_members {
            return Err(AjoError::CircleAtCapacity);
        }

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        member_data.total_contributed = member_data
            .total_contributed
            .checked_add(amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        // Update total pool
        let pool: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0_i128);
        let new_pool = pool.checked_add(amount).ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        // Emit deposit event
        env.events().publish(
            (symbol_short!("deposit"), member.clone()),
            amount,
        );

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

        // Emit MemberBooted event
        env.events().publish(
            (symbol_short!("booted"), member.clone()),
            (admin.clone(), env.ledger().timestamp())
        );

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

    // ---------------- QUERIES ----------------
    pub fn get_total_pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0_i128)
    }

    pub fn get_member_balance(env: Env, member: Address) -> Result<i128, AjoError> {
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;
        let data = members.get(member).ok_or(AjoError::NotFound)?;
        Ok(data.total_contributed)
    }

    // ---------------- PAYOUT ----------------
    pub fn claim_payout(
        env: Env,
        member: Address,
        cycle: u32,
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

        // Emit FundsWithdrawn event
        env.events().publish(
            (symbol_short!("withdraw"), member.clone()),
            (payout, cycle, circle.current_round, env.ledger().timestamp())
        );

        Ok(payout)
    }

    // ---------------- DEPOSIT (alias for contribute with fixed amount) ----------------
    pub fn deposit(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        // Check if circle is panicked
        let circle_status: Option<bool> = env.storage().instance().get(&DataKey::CircleStatus);
        if let Some(true) = circle_status {
            return Err(AjoError::CirclePanicked);
        }

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

        // Check if member is disqualified
        let standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(standing) = standings.get(member.clone()) {
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
            // Check if member has missed 3 contributions (auto-disqualify)
            if standing.missed_count >= 3 {
                return Err(AjoError::Disqualified);
            }
        }

        // Transfer the contribution amount
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &circle.contribution_amount);

        // Update member data
        member_data.total_contributed = member_data.total_contributed
            .checked_add(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;

        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        // Update total pool
        let current_pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        let new_pool = current_pool
            .checked_add(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        // Update last deposit timestamp
        let mut last_deposits: Map<Address, u64> = env
            .storage()
            .instance()
            .get(&DataKey::LastDepositAt)
            .unwrap_or_else(|| Map::new(&env));
        last_deposits.set(member.clone(), env.ledger().timestamp());
        env.storage().instance().set(&DataKey::LastDepositAt, &last_deposits);

        // Reset missed count for this member
        let mut updated_standings = standings;
        if let Some(mut standing) = updated_standings.get(member.clone()) {
            standing.missed_count = 0;
            updated_standings.set(member.clone(), standing);
            env.storage().instance().set(&DataKey::Standings, &updated_standings);
        }

        // Emit DepositReceived event
        env.events().publish(
            (symbol_short!("deposit"), member.clone()),
            (circle.contribution_amount, circle.current_round, env.ledger().timestamp())
        );

        Ok(())
    }

    // ---------------- ENHANCED CONTRIBUTION WITH EVENTS ----------------
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
        members.set(member.clone(), member_data);

        env.storage().instance().set(&DataKey::Members, &members);

        // Emit ContributionMade event
        env.events().publish(
            (symbol_short!("contrib"), member.clone()),
            (amount, circle.current_round, env.ledger().timestamp())
        );

        Ok(())
    }

    // ---------------- ADMIN FUNCTIONS (continued) ----------------
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    pub fn slash_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        let mut standing = standings
            .get(member.clone())
            .unwrap_or(MemberStanding { missed_count: 0, is_active: true });

        standing.missed_count += 1;

        // Auto-disqualify after 3 missed contributions
        if standing.missed_count >= 3 {
            standing.is_active = false;
        }

        standings.set(member.clone(), standing);
        env.storage().instance().set(&DataKey::Standings, &standings);

        // Emit MemberSlashed event
        env.events().publish(
            (symbol_short!("slash"), member.clone()),
            (standing.missed_count, standing.is_active)
        );

        Ok(())
    }

    pub fn panic(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &true);

        // Emit CirclePanicked event
        env.events().publish(
            (symbol_short!("panic"), admin.clone()),
            env.ledger().timestamp()
        );

        Ok(())
    }

    // ---------------- GETTER FUNCTIONS ----------------
    pub fn get_total_pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0)
    }

    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError> {
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        members.get(member).ok_or(AjoError::NotFound)
    }

    pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError> {
        let last_deposits: Map<Address, u64> = env
            .storage()
            .instance()
            .get(&DataKey::LastDepositAt)
            .unwrap_or_else(|| Map::new(&env));

        last_deposits.get(member).ok_or(AjoError::NotFound)
    }

    pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError> {
        env.storage().instance().get(&DataKey::Circle).ok_or(AjoError::NotFound)
    }
}
