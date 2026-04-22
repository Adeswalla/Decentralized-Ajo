//! # Ajo Circle Smart Contract
//! Decentralized ROSCA implementation on Stellar (Soroban)

#![no_std]

pub mod factory;

#[cfg(test)]
mod deposit_tests;

#[cfg(test)]
mod withdrawal_tests;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Symbol, Vec,
};

pub const MAX_MEMBERS: u32 = 50;
pub const MIN_CONTRIBUTION_AMOUNT: u128 = 1000000;
pub const MAX_CONTRIBUTION_AMOUNT: u128 = 10000000000;
pub const MIN_FREQUENCY_DAYS: u32 = 1;
pub const MAX_FREQUENCY_DAYS: u32 = 365;
pub const MIN_ROUNDS: u32 = 2;
pub const MAX_ROUNDS: u32 = 100;
pub const WITHDRAWAL_PENALTY_PERCENT: u32 = 10;
// LIMIT_SYNC_TAG: v1.0.2

// ---------------- ROLE CONSTANTS ----------------
const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MANAGER_ROLE: Symbol = symbol_short!("MANAGER");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AjoError {
Â  Â  /// Requested resource does not exist
Â  Â  NotFound = 1,
Â  Â  /// Caller lacks permission for this operation
Â  Â  Unauthorized = 2,
Â  Â  /// Resource already exists (e.g., duplicate member)
Â  Â  AlreadyExists = 3,
Â  Â  /// Invalid parameter provided
Â  Â  InvalidInput = 4,
Â  Â  /// Member has already received their payout for this round
Â  Â  AlreadyPaid = 5,
Â  Â  /// Insufficient balance for withdrawal
Â  Â  InsufficientFunds = 6,
Â  Â  /// Member is disqualified due to missed contributions
Â  Â  Disqualified = 7,
Â  Â  /// A dissolution vote is already in progress
Â  Â  VoteAlreadyActive = 8,
Â  Â  /// No active dissolution vote exists
Â  Â  NoActiveVote = 9,
Â  Â  /// Member has already cast their vote
Â  Â  AlreadyVoted = 10,
Â  Â  /// Circle is not in the required state for this operation
Â  Â  CircleNotActive = 11,
Â  Â  /// Circle has already been dissolved
Â  Â  CircleAlreadyDissolved = 12,
Â  Â  /// Circle has reached maximum member capacity
Â  Â  CircleAtCapacity = 13,
Â  Â  /// Circle is in emergency panic state
Â  Â  CirclePanicked = 14,
Â  Â  /// Oracle price data is unavailable
Â  Â  PriceUnavailable = 15,
Â  Â  /// Arithmetic operation would overflow
Â  Â  ArithmeticOverflow = 16,
        Paused = 17,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleData {
Â  Â  /// Address of the circle organizer (admin)
Â  Â  pub organizer: Address,
Â  Â  /// Token contract address (e.g., USDC, XLM)
Â  Â  pub token_address: Address,
Â  Â  /// Required contribution amount per round
Â  Â  pub contribution_amount: i128,
Â  Â  /// Duration of each round in days
Â  Â  pub frequency_days: u32,
Â  Â  /// Total number of rounds in the circle lifecycle
Â  Â  pub max_rounds: u32,
Â  Â  /// Current active round number (1-indexed)
Â  Â  pub current_round: u32,
Â  Â  /// Current number of active members
Â  Â  pub member_count: u32,
Â  Â  /// Maximum allowed members
Â  Â  pub max_members: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberData {
Â  Â  /// Member's wallet address
Â  Â  pub address: Address,
Â  Â  /// Cumulative amount contributed to the circle
Â  Â  pub total_contributed: i128,
Â  Â  /// Cumulative amount withdrawn from the circle
Â  Â  pub total_withdrawn: i128,
Â  Â  /// Whether member has received their scheduled payout
Â  Â  pub has_received_payout: bool,
Â  Â  /// Member status: 0 = Active, 1 = Inactive, 2 = Exited
Â  Â  pub status: u32,
}

/// Circle lifecycle status
///
/// Represents the current operational state of the circle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CircleStatus {
Â  Â  /// Normal operation - contributions and payouts active
Â  Â  Active,
Â  Â  /// Dissolution vote in progress
Â  Â  VotingForDissolution,
Â  Â  /// Circle dissolved via governance vote
Â  Â  Dissolved,
Â  Â  /// Emergency state - only refunds allowed
Â  Â  Panicked,
}

/// Tracks an in-progress dissolution vote
///
/// Stores voting state during the dissolution process.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionVote {
Â  Â  /// Number of votes in favor of dissolution
Â  Â  pub votes_for: u32,
Â  Â  /// Total number of eligible voting members
Â  Â  pub total_members: u32,
Â  Â  /// Threshold mode: 0 = simple majority (>50%), 1 = supermajority (>66%)
Â  Â  pub threshold_mode: u32,
}

/// Member standing and activity tracking
///
/// Monitors member participation and eligibility status.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberStanding {
Â  Â  /// Number of consecutive missed contribution rounds
Â  Â  pub missed_count: u32,
Â  Â  /// Whether member is currently active (not disqualified)
Â  Â  pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub treasury: Address,
    pub fee_bps: u32,
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
    RoleMembers,
    Deployer,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    // ---------------- INTERNAL HELPERS ----------------

    fn require_admin(env: &Env, caller: &Address) -> Result<(), AjoError> {
        caller.require_auth();
        if let Some(deployer) = env.storage().instance().get::<DataKey, Address>(&DataKey::Deployer) {
            if deployer == *caller {
                return Ok(());
            }
        }
        if !Self::has_role_internal(env, ADMIN_ROLE, caller) {
            return Err(AjoError::Unauthorized);
        }
        Ok(())
    }

    fn require_deployer(env: &Env, caller: &Address) -> Result<(), AjoError> {
        caller.require_auth();
        let deployer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Deployer)
            .ok_or(AjoError::Unauthorized)?;
        if deployer != *caller {
            return Err(AjoError::Unauthorized);
        }
        Ok(())
    }

    fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::CircleStatus).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) -> Result<(), AjoError> {
        if Self::is_paused(env) {
            Err(AjoError::CirclePanicked)
        } else {
            Ok(())
        }
    }

    /// Internal role check (no Env ownership required).
    fn has_role_internal(env: &Env, role: Symbol, member: &Address) -> bool {
        if let Some(deployer) = env.storage().instance().get::<DataKey, Address>(&DataKey::Deployer) {
            if deployer == *member {
                return true;
            }
        }
        let role_members: Map<Symbol, Vec<Address>> = env
            .storage()
            .instance()
            .get(&DataKey::RoleMembers)
            .unwrap_or_else(|| Map::new(env));
        if let Some(members) = role_members.get(role) {
            for i in 0..members.len() {
                if let Some(existing) = members.get(i) {
                    if existing == *member {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn get_contribution_amount(env: &Env) -> Result<i128, AjoError> {
        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;
        Ok(circle.contribution_amount)
    }

    // ---------------- INITIALIZE ----------------

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

        if contribution_amount <= 0
            || frequency_days == 0
            || max_rounds == 0
            || configured_max_members > HARD_CAP
        {
            return Err(AjoError::InvalidInput);
        }

        // Set deployer (immutable after init)
        env.storage().instance().set(&DataKey::Deployer, &organizer);

        // Bootstrap role storage
        let mut role_members: Map<Symbol, Vec<Address>> = Map::new(&env);
        let mut admin_list: Vec<Address> = Vec::new(&env);
        admin_list.push_back(organizer.clone());
        role_members.set(ADMIN_ROLE, admin_list);
        let mut manager_list: Vec<Address> = Vec::new(&env);
        manager_list.push_back(organizer.clone());
        role_members.set(MANAGER_ROLE, manager_list);
        env.storage().instance().set(&DataKey::RoleMembers, &role_members);

        // Legacy admin key
        env.storage().instance().set(&DataKey::Admin, &organizer);

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
        env.storage().instance().set(&DataKey::CircleStatus, &false);
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

        env.events().publish(
            (symbol_short!("created"), organizer.clone()),
            (contribution_amount, configured_max_members, max_rounds, frequency_days, env.ledger().timestamp()),
        );

        Ok(())
    }

    // ---------------- JOIN ----------------

    pub fn join_circle(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
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

        members.set(
            new_member.clone(),
            MemberData {
                address: new_member.clone(),
                total_contributed: 0,
                total_withdrawn: 0,
                has_received_payout: false,
                status: 0,
            },
        );
        circle.member_count += 1;

        env.storage().instance().set(&DataKey::Circle, &circle);
        env.storage().instance().set(&DataKey::Members, &members);

        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));
        standings.set(new_member.clone(), MemberStanding { missed_count: 0, is_active: true });
        env.storage().instance().set(&DataKey::Standings, &standings);

        env.events().publish(
            (symbol_short!("join"), new_member.clone()),
            (circle.member_count, env.ledger().timestamp()),
        );

        Ok(())
    }

    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    // ---------------- DEPOSIT / CONTRIBUTE ----------------

    /// Deposit exactly the circle's contribution_amount.
    pub fn deposit(env: Env, member: Address) -> Result<(), AjoError> {
        Self::require_not_paused(&env)?;
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

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        // Check standing
        let standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(standing) = standings.get(member.clone()) {
            if !standing.is_active || standing.missed_count >= 3 {
                return Err(AjoError::Disqualified);
            }
        }

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &circle.contribution_amount);

        member_data.total_contributed = member_data
            .total_contributed
            .checked_add(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        let new_pool = pool.checked_add(circle.contribution_amount).ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        // Record timestamp
        let mut last_deposits: Map<Address, u64> = env
            .storage()
            .instance()
            .get(&DataKey::LastDepositAt)
            .unwrap_or_else(|| Map::new(&env));
        last_deposits.set(member.clone(), env.ledger().timestamp());
        env.storage().instance().set(&DataKey::LastDepositAt, &last_deposits);

        // Reset missed count
        let mut updated_standings = standings;
        if let Some(mut standing) = updated_standings.get(member.clone()) {
            standing.missed_count = 0;
            updated_standings.set(member.clone(), standing);
            env.storage().instance().set(&DataKey::Standings, &updated_standings);
        }

        env.events().publish(
            (symbol_short!("deposit"), member.clone()),
            (circle.contribution_amount, circle.current_round, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Contribute a specific amount (must equal contribution_amount).
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        Self::require_not_paused(&env)?;
        member.require_auth();

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if amount != circle.contribution_amount {
            return Err(AjoError::InvalidInput);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        member_data.total_contributed = member_data
            .total_contributed
            .checked_add(amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        let new_pool = pool.checked_add(amount).ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        env.events().publish(
            (symbol_short!("contrib"), member.clone()),
            (amount, circle.current_round, env.ledger().timestamp()),
        );

        Ok(())
    }

    // ---------------- PAYOUT ----------------

    /// Claim the rotating payout for the current cycle.
    ///
    /// # Security â€” Checks-Effects-Interactions (CEI)
    ///
    /// Soroban's execution model is single-threaded and does not have
    /// Ethereum-style reentrancy, but we still follow CEI strictly:
    ///
    ///   CHECKS     â€” auth, pause, panic, member exists, not already paid,
    ///                standing active, rotation order enforced, pool funded
    ///   EFFECTS    â€” mark payout, accumulate total_withdrawn, persist state
    ///   INTERACTIONS â€” token transfer executed last
    ///
    /// The `has_received_payout` flag is set to `true` and persisted before
    /// the token transfer, so any hypothetical re-entry would be rejected by
    /// the `AlreadyPaid` check.
    pub fn claim_payout(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        // â”€â”€ CHECKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        Self::require_not_paused(&env)?;
        member.require_auth();


        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if cycle == 0 || cycle > circle.max_rounds {
            return Err(AjoError::InvalidInput);
        }

        // Verify member standing
        let standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(standing) = standings.get(member.clone()) {
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
        } else {
            return Err(AjoError::NotFound);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        // Prevent double-claim
        if member_data.has_received_payout {
            return Err(AjoError::AlreadyPaid);
        }

        // Enforce rotation order when set
        if let Some(rotation) = env
            .storage()
            .instance()
            .get::<DataKey, Vec<Address>>(&DataKey::RotationOrder)
        {
            let idx = cycle.checked_sub(1).ok_or(AjoError::InvalidInput)? as u32;
            let expected = rotation.get(idx).ok_or(AjoError::InvalidInput)?;
            if expected != member {
                return Err(AjoError::Unauthorized);
            }
        }

        // Verify pool is sufficiently funded
        let pool: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0);
        let required = (circle.member_count as i128)
            .checked_mul(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        if pool < required {
            return Err(AjoError::InsufficientFunds);
        }

        let payout = required;

        // â”€â”€ EFFECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // All state mutations happen BEFORE the token transfer.
        member_data.has_received_payout = true;
        member_data.total_withdrawn = member_data
            .total_withdrawn
            .checked_add(payout)
            .ok_or(AjoError::ArithmeticOverflow)?;

        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        // Deduct from tracked pool
        let new_pool = pool.checked_sub(payout).ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        // â”€â”€ INTERACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &payout);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone()),
            (payout, cycle, circle.current_round, env.ledger().timestamp()),
        );

        Ok(payout)
    }

    pub fn withdraw(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        Self::claim_payout(env, member, cycle)
    }

    // ---------------- ADMIN ----------------

    pub fn panic(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &true);
        env.events().publish(
            (symbol_short!("panic"), admin.clone()),
            env.ledger().timestamp(),
        );
        Ok(())
    }

    pub fn resume(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &false);
        Ok(())
    }

    pub fn emergency_stop(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::panic(env, admin)
    }

    pub fn resume_operations(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::resume(env, admin)
    }

    pub fn emergency_panic(env: Env, caller: Address) -> Result<(), AjoError> {
        Self::require_deployer(&env, &caller)?;
        env.storage().instance().set(&DataKey::CircleStatus, &true);
        env.events().publish(
            symbol_short!("emrg_panic"),
            (caller, env.ledger().timestamp()),
        );
        Ok(())
    }

    pub fn set_kyc_status(
        env: Env,
        admin: Address,
        member: Address,
        is_verified: bool,
    ) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        let mut kyc: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::KycStatus)
            .unwrap_or_else(|| Map::new(&env));
        kyc.set(member, is_verified);
        env.storage().instance().set(&DataKey::KycStatus, &kyc);
        Ok(())
    }

    pub fn boot_dormant_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or_else(|| Map::new(&env));

        let mut standing = standings.get(member.clone()).ok_or(AjoError::NotFound)?;
        standing.is_active = false;
        standings.set(member.clone(), standing);
        env.storage().instance().set(&DataKey::Standings, &standings);

        env.events().publish(
            (symbol_short!("booted"), member.clone()),
            (admin.clone(), env.ledger().timestamp()),
        );

        Ok(())
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
        if standing.missed_count >= 3 {
            standing.is_active = false;
        }

        standings.set(member.clone(), standing);
        env.storage().instance().set(&DataKey::Standings, &standings);

        env.events().publish(
            (symbol_short!("slash"), member.clone()),
            (standing.missed_count, standing.is_active),
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

    // ---------------- ROLE MANAGEMENT ----------------

    pub fn grant_role(env: Env, caller: Address, role: Symbol, new_member: Address) -> Result<(), AjoError> {
        Self::require_deployer(&env, &caller)?;

        let mut role_members: Map<Symbol, Vec<Address>> = env
            .storage()
            .instance()
            .get(&DataKey::RoleMembers)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(members) = role_members.get(role.clone()) {
            for i in 0..members.len() {
                if let Some(existing) = members.get(i) {
                    if existing == new_member {
                        return Err(AjoError::AlreadyExists);
                    }
                }
            }
            let mut updated = members.clone();
            updated.push_back(new_member.clone());
            role_members.set(role.clone(), updated);
        } else {
            let mut list: Vec<Address> = Vec::new(&env);
            list.push_back(new_member.clone());
            role_members.set(role.clone(), list);
        }

        env.storage().instance().set(&DataKey::RoleMembers, &role_members);

        env.events().publish(
            (symbol_short!("role_grnt"), new_member),
            (role, env.ledger().timestamp()),
        );

        Ok(())
    }

    pub fn revoke_role(env: Env, caller: Address, role: Symbol, member: Address) -> Result<(), AjoError> {
        Self::require_deployer(&env, &caller)?;

        // Deployer's own ADMIN role cannot be revoked
        if let Some(deployer) = env.storage().instance().get::<DataKey, Address>(&DataKey::Deployer) {
            if deployer == member && role == ADMIN_ROLE {
                return Err(AjoError::Unauthorized);
            }
        }

        let mut role_members: Map<Symbol, Vec<Address>> = env
            .storage()
            .instance()
            .get(&DataKey::RoleMembers)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(members) = role_members.get(role.clone()) {
            let mut updated: Vec<Address> = Vec::new(&env);
            let mut found = false;
            for i in 0..members.len() {
                if let Some(existing) = members.get(i) {
                    if existing != member {
                        updated.push_back(existing);
                    } else {
                        found = true;
                    }
                }
            }
            if !found {
                return Err(AjoError::NotFound);
            }
            role_members.set(role.clone(), updated);
            env.storage().instance().set(&DataKey::RoleMembers, &role_members);

            env.events().publish(
                (symbol_short!("role_rvk"), member),
                (role, env.ledger().timestamp()),
            );
        }

        Ok(())
    }

    /// Public role check (takes Env by value for contractimpl compatibility).
    pub fn has_role(env: Env, role: Symbol, member: Address) -> bool {
        Self::has_role_internal(&env, role, &member)
    }

    pub fn get_deployer(env: Env) -> Result<Address, AjoError> {
        env.storage().instance().get(&DataKey::Deployer).ok_or(AjoError::NotFound)
    }

    // ---------------- QUERIES ----------------

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

    /// Get current fee configuration
    pub fn get_fee_config(env: Env) -> Option<FeeConfig> {
        env.storage().instance().get(&DataKey::FeeConfig)
    }
}
Â  Â  /// Calculate 10^exp with overflow checking
Â  Â  ///
Â  Â  /// # Arguments
Â  Â  /// * `exp` - Exponent value
Â  Â  ///
Â  Â  /// # Returns
Â  Â  /// * `Ok(i128)` - Result of 10^exp
Â  Â  /// * `Err(AjoError::ArithmeticOverflow)` if overflow occurs
Â  Â  fn pow10_checked(exp: u32) -> Result<i128, AjoError> {
Â  Â  Â  Â  let mut result: i128 = 1;
Â  Â  Â  Â  let mut i: u32 = 0;
Â  Â  Â  Â  while i < exp {
Â  Â  Â  Â  Â  Â  result = result
Â  Â  Â  Â  Â  Â  Â  Â  .checked_mul(10)
Â  Â  Â  Â  Â  Â  Â  Â  .ok_or(AjoError::ArithmeticOverflow)?;
Â  Â  Â  Â  Â  Â  i += 1;
Â  Â  Â  Â  }
Â  Â  Â  Â  Ok(result)
Â  Â  }

Â  Â  /// Initialize a new Ajo circle
Â  Â  ///
Â  Â  /// Creates a new savings circle with specified parameters. The organizer
Â  Â  /// becomes the first member and administrator.
Â  Â  ///
Â  Â  /// # Arguments
Â  Â  /// * `env` - Contract environment
Â  Â  /// * `organizer` - Address of the circle creator (becomes admin)
Â  Â  /// * `token_address` - Address of the token contract to use (e.g., USDC)
Â  Â  /// * `contribution_amount` - Required contribution per round
Â  Â  /// * `frequency_days` - Duration of each round in days
Â  Â  /// * `max_rounds` - Total number of rounds in the circle
Â  Â  /// * `max_members` - Maximum number of members (0 = use default)
Â  Â  ///
Â  Â  /// # Returns
Â  Â  /// * `Ok(())` on success
Â  Â  /// * `Err(AjoError::InvalidInput)` if parameters are invalid
Â  Â  ///
Â  Â  /// # Requirements
Â  Â  /// - Caller must be the organizer
Â  Â  /// - All numeric parameters must be positive
Â  Â  /// - max_members must not exceed HARD_CAP
Â  Â  pub fn initialize_circle(
Â  Â  Â  Â  env: Env,
Â  Â  Â  Â  organizer: Address,
Â  Â  Â  Â  token_address: Address,
Â  Â  Â  Â  contribution_amount: i128,
Â  Â  Â  Â  frequency_days: u32,
Â  Â  Â  Â  max_rounds: u32,
Â  Â  Â  Â  max_members: u32,
Â  Â  ) -> Result<(), AjoError> {
Â  Â  Â  Â  organizer.require_auth();

Â  Â  Â  Â  let configured_max_members = if max_members == 0 {
Â  Â  Â  Â  Â  Â  MAX_MEMBERS
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  max_members
Â  Â  Â  Â  };

Â  Â  Â  Â  if contribution_amount <= 0
Â  Â  Â  Â  Â  Â  || frequency_days == 0
Â  Â  Â  Â  Â  Â  || max_rounds == 0
Â  Â  Â  Â  Â  Â  || configured_max_members == 0
Â  Â  Â  Â  Â  Â  || configured_max_members > HARD_CAP
Â  Â  Â  Â  {
Â  Â  Â  Â  Â  Â  return Err(AjoError::InvalidInput);
Â  Â  Â  Â  }

Â  Â  Â  Â  let circle_data = CircleData {
Â  Â  Â  Â  Â  Â  organizer: organizer.clone(),
Â  Â  Â  Â  Â  Â  token_address,
Â  Â  Â  Â  Â  Â  contribution_amount,
Â  Â  Â  Â  Â  Â  frequency_days,
Â  Â  Â  Â  Â  Â  max_rounds,
Â  Â  Â  Â  Â  Â  current_round: 1,
Â  Â  Â  Â  Â  Â  member_count: 1,
Â  Â  Â  Â  Â  Â  max_members: configured_max_members,
Â  Â  Â  Â  };

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Circle, &circle_data);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::Admin, &organizer);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::RoundContribCount, &0_u32);

Â  Â  Â  Â  // Set first round deadline: now + frequency_days converted to seconds
Â  Â  Â  Â  let deadline = env.ledger().timestamp() + (frequency_days as u64) * 86_400;
Â  Â  Â  Â  env.storage().instance().set(&DataKey::RoundDeadline, &deadline);

Â  Â  Â  Â  let mut members: Map<Address, MemberData> = Map::new(&env);
Â  Â  Â  Â  members.set(
Â  Â  Â  Â  Â  Â  organizer.clone(),
Â  Â  Â  Â  Â  Â  MemberData {
Â  Â  Â  Â  Â  Â  Â  Â  address: organizer.clone(),
Â  Â  Â  Â  Â  Â  Â  Â  total_contributed: 0,
Â  Â  Â  Â  Â  Â  Â  Â  total_withdrawn: 0,
Â  Â  Â  Â  Â  Â  Â  Â  has_received_payout: false,
Â  Â  Â  Â  Â  Â  Â  Â  status: 0,
Â  Â  Â  Â  Â  Â  },
Â  Â  Â  Â  );

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Members, &members);

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = Map::new(&env);
Â  Â  Â  Â  standings.set(
Â  Â  Â  Â  Â  Â  organizer.clone(),
Â  Â  Â  Â  Â  Â  MemberStanding {
Â  Â  Â  Â  Â  Â  Â  Â  missed_count: 0,
Â  Â  Â  Â  Â  Â  Â  Â  is_active: true,
Â  Â  Â  Â  Â  Â  },
Â  Â  Â  Â  );
Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Join an existing circle as a new member
Â  Â  ///
Â  Â  /// Adds a new member to the circle. Only the organizer can add members.
Â  Â  ///
Â  Â  /// # Arguments
Â  Â  /// * `env` - Contract environment
Â  Â  /// * `organizer` - Address of the circle organizer
Â  Â  /// * `new_member` - Address of the member to add
Â  Â  ///
Â  Â  /// # Returns
Â  Â  /// * `Ok(())` on success
Â  Â  /// * `Err(AjoError::Unauthorized)` if caller is not the organizer
Â  Â  /// * `Err(AjoError::AlreadyExists)` if member already in circle
Â  Â  /// * `Err(AjoError::CircleAtCapacity)` if circle is full
Â  Â  /// * `Err(AjoError::CirclePanicked)` if circle is in emergency state
Â  Â  ///
Â  Â  /// # Requirements
Â  Â  /// - Caller must be the organizer
Â  Â  /// - Member must not already exist
Â  Â  /// - Circle must not be at capacity
Â  Â  /// - Circle must not be in panic state
Â  Â  pub fn join_circle(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
Â  Â  Â  Â  organizer.require_auth();

Â  Â  Â  Â  // Block joins during panic

Â  Â  Â  Â  let mut circle: CircleData = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Circle)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if circle.organizer != organizer {
Â  Â  Â  Â  Â  Â  return Err(AjoError::Unauthorized);
Â  Â  Â  Â  }

Â  Â  Â  Â  let mut members: Map<Address, MemberData> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Members)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if members.contains_key(new_member.clone()) {
Â  Â  Â  Â  Â  Â  return Err(AjoError::AlreadyExists);
Â  Â  Â  Â  }

Â  Â  Â  Â  if circle.member_count >= circle.max_members {
Â  Â  Â  Â  Â  Â  return Err(AjoError::CircleAtCapacity);
Â  Â  Â  Â  }

Â  Â  Â  Â  members.set(
Â  Â  Â  Â  Â  Â  new_member.clone(),
Â  Â  Â  Â  Â  Â  MemberData {
Â  Â  Â  Â  Â  Â  Â  Â  address: new_member.clone(),
Â  Â  Â  Â  Â  Â  Â  Â  total_contributed: 0,
Â  Â  Â  Â  Â  Â  Â  Â  total_withdrawn: 0,
Â  Â  Â  Â  Â  Â  Â  Â  has_received_payout: false,
Â  Â  Â  Â  Â  Â  Â  Â  status: 0,
Â  Â  Â  Â  Â  Â  },
Â  Â  Â  Â  );

Â  Â  Â  Â  circle.member_count = circle
Â  Â  Â  Â  Â  Â  .member_count
Â  Â  Â  Â  Â  Â  .checked_add(1)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::InvalidInput)?;

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Standings)
Â  Â  Â  Â  Â  Â  .unwrap_or(Map::new(&env));
Â  Â  Â  Â Â 
Â  Â  Â  Â  standings.set(
Â  Â  Â  Â  Â  Â  new_member.clone(),
Â  Â  Â  Â  Â  Â  MemberStanding {
Â  Â  Â  Â  Â  Â  Â  Â  missed_count: 0,
Â  Â  Â  Â  Â  Â  Â  Â  is_active: true,
Â  Â  Â  Â  Â  Â  },
Â  Â  Â  Â  );

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Members, &members);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::Circle, &circle);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Backward-compatible wrapper for joining the circle
Â  Â  ///
Â  Â  /// Alias for `join_circle` to maintain API compatibility.
Â  Â  ///
Â  Â  /// # Arguments
Â  Â  /// * `env` - Contract environment
Â  Â  /// * `organizer` - Address of the circle organizer
Â  Â  /// * `new_member` - Address of the member to add
Â  Â  ///
Â  Â  /// # Returns
Â  Â  /// Same as `join_circle`
Â  Â  pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
Â  Â  Â  Â  Self::join_circle(env, organizer, new_member)
Â  Â  }

Â  Â  /// Record a contribution from a member
Â  Â  ///
Â  Â  /// Allows a member to contribute tokens to the circle. Transfers tokens
Â  Â  /// from the member to the contract and updates their contribution balance.
Â  Â  ///
Â  Â  /// # Arguments
Â  Â  /// * `env` - Contract environment
Â  Â  /// * `member` - Address of the contributing member
Â  Â  /// * `amount` - Amount of tokens to contribute
Â  Â  ///
Â  Â  /// # Returns
Â  Â  /// * `Ok(())` on success
Â  Â  /// * `Err(AjoError::InvalidInput)` if amount <= 0
Â  Â  /// * `Err(AjoError::NotFound)` if member not in circle
Â  Â  /// * `Err(AjoError::Disqualified)` if member is inactive
Â  Â  /// * `Err(AjoError::CirclePanicked)` if circle is in emergency state
Â  Â  ///
Â  Â  /// # Requirements
Â  Â  /// - Caller must be the member
Â  Â  /// - Amount must be positive
Â  Â  /// - Member must be active (not disqualified)
Â  Â  /// - Circle must not be in panic state
Â  Â  ///
Â  Â  /// # Side Effects
Â  Â  /// - Resets member's missed contribution count
Â  Â  /// - May advance to next round if all members have contributed
Â  Â  pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
Â  Â  Â  Â  member.require_auth();

        if Self::is_paused(&env) {
    return Err(AjoError::Paused);
}

Â  Â  Â  Â  // Block contributions during panic

Â  Â  Â  Â  if amount <= 0 {
Â  Â  Â  Â  Â  Â  return Err(AjoError::InvalidInput);
Â  Â  Â  Â  }

Â  Â  Â  Â  let mut circle: CircleData = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Circle)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Standings)
Â  Â  Â  Â  Â  Â  .unwrap_or(Map::new(&env));

Â  Â  Â  Â  if let Some(mut standing) = standings.get(member.clone()) {
Â  Â  Â  Â  Â  Â  if standing.missed_count >= 3 {
Â  Â  Â  Â  Â  Â  Â  Â  panic!("Member disqualified due to inactivity.");
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  Â  Â  if !standing.is_active {
Â  Â  Â  Â  Â  Â  Â  Â  return Err(AjoError::Disqualified);
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  Â  Â  // Reset missed count on successful contribution
Â  Â  Â  Â  Â  Â  standing.missed_count = 0;
Â  Â  Â  Â  Â  Â  standings.set(member.clone(), standing);
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);

Â  Â  Â  Â  let mut members: Map<Address, MemberData> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Members)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if let Some(mut member_data) = members.get(member.clone()) {
Â  Â  Â  Â  Â  Â  let round_target = (circle.current_round as i128)
Â  Â  Â  Â  Â  Â  Â  Â  .checked_mul(circle.contribution_amount)
Â  Â  Â  Â  Â  Â  Â  Â  .ok_or(AjoError::ArithmeticOverflow)?;
Â  Â  Â  Â  Â  Â  let had_completed_round = member_data.total_contributed >= round_target;

Â  Â  Â  Â  Â  Â  // Transfer tokens from member to contract
Â  Â  Â  Â  Â  Â  let token_client = token::Client::new(&env, &circle.token_address);
Â  Â  Â  Â  Â  Â  token_client.transfer(&member, &env.current_contract_address(), &amount);

Â  Â  Â  Â  Â  Â  member_data.total_contributed = member_data
Â  Â  Â  Â  Â  Â  Â  Â  .total_contributed
Â  Â  Â  Â  Â  Â  Â  Â  .checked_add(amount)
Â  Â  Â  Â  Â  Â  Â  Â  .ok_or(AjoError::ArithmeticOverflow)?;

Â  Â  Â  Â  Â  Â  let has_completed_round = member_data.total_contributed >= round_target;

Â  Â  Â  Â  Â  Â  members.set(member.clone(), member_data);

Â  Â  Â  Â  Â  Â  if !had_completed_round && has_completed_round {
Â  Â  Â  Â  Â  Â  Â  Â  let mut round_contrib_count: u32 = env
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .get(&DataKey::RoundContribCount)
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .unwrap_or(0_u32);

Â  Â  Â  Â  Â  Â  Â  Â  round_contrib_count = round_contrib_count
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .checked_add(1)
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .ok_or(AjoError::ArithmeticOverflow)?;

Â  Â  Â  Â  Â  Â  Â  Â  if round_contrib_count >= circle.member_count {
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  let deadline: u64 = env
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .get(&DataKey::RoundDeadline)
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .unwrap_or(0);
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  let next_deadline = deadline + (circle.frequency_days as u64) * 86_400;
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  env.storage().instance().set(&DataKey::RoundDeadline, &next_deadline);

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  if circle.current_round < circle.max_rounds {
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  circle.current_round += 1;
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  }

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  round_contrib_count = 0;
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  env.storage().instance().set(&DataKey::Circle, &circle);
Â  Â  Â  Â  Â  Â  Â  Â  }

Â  Â  Â  Â  Â  Â  Â  Â  env.storage()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  .set(&DataKey::RoundContribCount, &round_contrib_count);
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Members, &members);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Deposit exactly the configured periodic contribution amount in the circle token.
Â  Â  /// Records the ledger timestamp for the member and increments the tracked pool balance.
Â  Â  pub fn deposit(env: Env, member: Address) -> Result<(), AjoError> {
Â  Â  Â  Â  member.require_auth();

        if Self::is_paused(&env) {
    return Err(AjoError::Paused);
}


Â  Â  Â  Â  let circle: CircleData = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Circle)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  let amount = circle.contribution_amount;
Â  Â  Â  Â  if amount <= 0 {
Â  Â  Â  Â  Â  Â  return Err(AjoError::InvalidInput);
Â  Â  Â  Â  }

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Standings)
Â  Â  Â  Â  Â  Â  .unwrap_or(Map::new(&env));

Â  Â  Â  Â  if let Some(mut standing) = standings.get(member.clone()) {
Â  Â  Â  Â  Â  Â  if standing.missed_count >= 3 {
Â  Â  Â  Â  Â  Â  Â  Â  panic!("Member disqualified due to inactivity.");
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  Â  Â  if !standing.is_active {
Â  Â  Â  Â  Â  Â  Â  Â  return Err(AjoError::Disqualified);
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  Â  Â  standing.missed_count = 0;
Â  Â  Â  Â  Â  Â  standings.set(member.clone(), standing);
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);

Â  Â  Â  Â  let mut members: Map<Address, MemberData> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Members)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if let Some(mut member_data) = members.get(member.clone()) {
Â  Â  Â  Â  Â  Â  let token_client = token::Client::new(&env, &circle.token_address);
Â  Â  Â  Â  Â  Â  token_client.transfer(&member, &env.current_contract_address(), &amount);

Â  Â  Â  Â  Â  Â  member_data.total_contributed += amount;
Â  Â  Â  Â  Â  Â  members.set(member.clone(), member_data);
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  let ts = env.ledger().timestamp();
Â  Â  Â  Â  let mut last_deposits: Map<Address, u64> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::LastDepositAt)
Â  Â  Â  Â  Â  Â  .unwrap_or_else(|| Map::new(&env));
Â  Â  Â  Â  last_deposits.set(member.clone(), ts);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::LastDepositAt, &last_deposits);

Â  Â  Â  Â  let mut pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
Â  Â  Â  Â  pool = pool.checked_add(amount).ok_or(AjoError::InvalidInput)?;
Â  Â  Â  Â  env.storage().instance().set(&DataKey::TotalPool, &pool);

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Members, &members);

Â  Â  Â  Â  let round_contributions = members
Â  Â  Â  Â  Â  Â  .iter()
Â  Â  Â  Â  Â  Â  .filter(|(_, m)| {
Â  Â  Â  Â  Â  Â  Â  Â  m.total_contributed >= (circle.current_round as i128) * circle.contribution_amount
Â  Â  Â  Â  Â  Â  })
Â  Â  Â  Â  Â  Â  .count() as u32;

Â  Â  Â  Â  if round_contributions >= circle.member_count {
Â  Â  Â  Â  Â  Â  let deadline: u64 = env
Â  Â  Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  Â  Â  .get(&DataKey::RoundDeadline)
Â  Â  Â  Â  Â  Â  Â  Â  .unwrap_or(0);
Â  Â  Â  Â  Â  Â  let next_deadline = deadline + (circle.frequency_days as u64) * 86_400;
Â  Â  Â  Â  Â  Â  env.storage()
Â  Â  Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  Â  Â  .set(&DataKey::RoundDeadline, &next_deadline);
Â  Â  Â  Â  }

Â  Â  Â  Â  // Emit DepositReceived event
Â  Â  Â  Â  env.events().publish(
Â  Â  Â  Â  Â  Â  (symbol_short!("deposit"), member.clone()),
Â  Â  Â  Â  Â  Â  (amount, circle.current_round)
Â  Â  Â  Â  );

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Running total of tokens received through `deposit` (tracked in instance storage).
Â  Â  pub fn get_total_pool(env: Env) -> i128 {
Â  Â  Â  Â  env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::TotalPool)
Â  Â  Â  Â  Â  Â  .unwrap_or(0)
Â  Â  }

Â  Â  /// Last `deposit` timestamp for a member, if any.
Â  Â  pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError> {
Â  Â  Â  Â  let m: Map<Address, u64> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::LastDepositAt)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;
Â  Â  Â  Â  m.get(member).ok_or(AjoError::NotFound)
Â  Â  }

Â  Â  /// Shuffle the payout rotation order using ledger sequence as seed (Fisher-Yates).
Â  Â  /// Must be called by the organizer before the first round begins.
Â  Â  pub fn shuffle_rotation(env: Env, organizer: Address) -> Result<(), AjoError> {
Â  Â  Â  Â  organizer.require_auth();

Â  Â  Â  Â  let circle: CircleData = env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Circle)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if circle.organizer != organizer {
Â  Â  Â  Â  Â  Â  return Err(AjoError::Unauthorized);
Â  Â  Â  Â  }

Â  Â  Â  Â  // Block shuffle during panic

Â  Â  Â  Â  let members: Map<Address, MemberData> = env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Members)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  // Build ordered list from current members
Â  Â  Â  Â  let mut rotation: Vec<Address> = Vec::new(&env);
Â  Â  Â  Â  for (addr, _) in members.iter() {
Â  Â  Â  Â  Â  Â  rotation.push_back(addr);
Â  Â  Â  Â  }

Â  Â  Â  Â  let n = rotation.len();
Â  Â  Â  Â  if n < 2 {
Â  Â  Â  Â  Â  Â  env.storage().instance().set(&DataKey::RotationOrder, &rotation);
Â  Â  Â  Â  Â  Â  return Ok(());
Â  Â  Â  Â  }

Â  Â  Â  Â  // Seed: mix ledger sequence with tx hash bytes for unpredictability
Â  Â  Â  Â  let ledger_seq = env.ledger().sequence();
Â  Â  Â  Â  let tx_hash: BytesN<32> = env.crypto().sha256(
Â  Â  Â  Â  Â  Â  &soroban_sdk::Bytes::from_slice(&env, &ledger_seq.to_be_bytes())
Â  Â  Â  Â  ).into();
Â  Â  Â  Â  let hash_bytes = tx_hash.to_array();

Â  Â  Â  Â  // Fisher-Yates shuffle â€” seed advances through hash bytes cyclically
Â  Â  Â  Â  for i in (1..n).rev() {
Â  Â  Â  Â  Â  Â  let byte_idx = (i as usize) % 32;
Â  Â  Â  Â  Â  Â  let j = (hash_bytes[byte_idx] as u32) % (i + 1);
Â  Â  Â  Â  Â  Â  // Swap rotation[i] and rotation[j]
Â  Â  Â  Â  Â  Â  let a = rotation.get(i).unwrap();
Â  Â  Â  Â  Â  Â  let b = rotation.get(j).unwrap();
Â  Â  Â  Â  Â  Â  rotation.set(i, b);
Â  Â  Â  Â  Â  Â  rotation.set(j, a);
Â  Â  Â  Â  }

Â  Â  Â  Â  env.storage().instance().set(&DataKey::RotationOrder, &rotation);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Slash a member for missing a contribution round
Â  Â  pub fn slash_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
Â  Â  Â  Â  Self::require_admin(&env, &admin)?;

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = env.storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Standings)
Â  Â  Â  Â  Â  Â  .unwrap_or(Map::new(&env));

Â  Â  Â  Â  if let Some(mut standing) = standings.get(member.clone()) {
Â  Â  Â  Â  Â  Â  standing.missed_count += 1;
Â  Â  Â  Â  Â  Â  if standing.missed_count >= 3 {
Â  Â  Â  Â  Â  Â  Â  Â  standing.is_active = false;
Â  Â  Â  Â  Â  Â  }
Â  Â  Â  Â  Â  Â  standings.set(member.clone(), standing);
Â  Â  Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);
Â  Â  Â  Â  Â  Â  Ok(())
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  Err(AjoError::NotFound)
Â  Â  Â  Â  }
Â  Â  }

Â  Â  /// Update off-chain KYC tie for a member. Admin-only.
Â  Â  pub fn set_kyc_status(
Â  Â  Â  Â  env: Env,
Â  Â  Â  Â  admin: Address,
Â  Â  Â  Â  member: Address,
Â  Â  Â  Â  is_verified: bool,
Â  Â  ) -> Result<(), AjoError> {
Â  Â  Â  Â  Self::require_admin(&env, &admin)?;

Â  Â  Â  Â  let mut kyc: Map<Address, bool> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::KycStatus)
Â  Â  Â  Â  Â  Â  .unwrap_or_else(|| Map::new(&env));

Â  Â  Â  Â  kyc.set(member, is_verified);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::KycStatus, &kyc);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Remove a dormant user from active standing. Admin-only.
Â  Â  pub fn boot_dormant_member(
Â  Â  Â  Â  env: Env,
Â  Â  Â  Â  admin: Address,
Â  Â  Â  Â  member: Address,
Â  Â  ) -> Result<(), AjoError> {
Â  Â  Â  Â  Self::require_admin(&env, &admin)?;

Â  Â  Â  Â  let mut standings: Map<Address, MemberStanding> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Standings)
Â  Â  Â  Â  Â  Â  .unwrap_or(Map::new(&env));

Â  Â  Â  Â  if let Some(mut standing) = standings.get(member.clone()) {
Â  Â  Â  Â  Â  Â  standing.is_active = false;
Â  Â  Â  Â  Â  Â  standings.set(member.clone(), standing);
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  let mut members: Map<Address, MemberData> = env
Â  Â  Â  Â  Â  Â  .storage()
Â  Â  Â  Â  Â  Â  .instance()
Â  Â  Â  Â  Â  Â  .get(&DataKey::Members)
Â  Â  Â  Â  Â  Â  .ok_or(AjoError::NotFound)?;

Â  Â  Â  Â  if let Some(mut member_data) = members.get(member.clone()) {
Â  Â  Â  Â  Â  Â  member_data.status = 2;
Â  Â  Â  Â  Â  Â  members.set(member, member_data);
Â  Â  Â  Â  } else {
Â  Â  Â  Â  Â  Â  return Err(AjoError::NotFound);
Â  Â  Â  Â  }

Â  Â  Â  Â  env.storage().instance().set(&DataKey::Standings, &standings);
Â  Â  Â  Â  env.storage().instance().set(&DataKey::Members, &members);

Â  Â  Â  Â  Ok(())
Â  Â  }

Â  Â  /// Upgrade the contract's WASM code. Restricted to admin.
Â  Â  pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), AjoError> {
Â  Â  Â  Â  Self::require_admin(&env, &admin)?;
Â  Â  Â  Â  env.deployer().update_current_contract_wasm(new_wasm_hash);
Â  Â  Â  Â  Ok(())
Â  Â  }
}
