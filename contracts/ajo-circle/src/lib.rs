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

const MAX_MEMBERS: u32 = 50;
const HARD_CAP: u32 = 100;

// ---------------- ROLE CONSTANTS ----------------
const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MANAGER_ROLE: Symbol = symbol_short!("MANAGER");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AjoError {
    /// Requested resource does not exist
    NotFound = 1,
    /// Caller lacks permission for this operation
    Unauthorized = 2,
    /// Resource already exists (e.g., duplicate member)
    AlreadyExists = 3,
    /// Invalid parameter provided
    InvalidInput = 4,
    /// Member has already received their payout for this round
    AlreadyPaid = 5,
    /// Insufficient balance for withdrawal
    InsufficientFunds = 6,
    /// Member is disqualified due to missed contributions
    Disqualified = 7,
    /// A dissolution vote is already in progress
    VoteAlreadyActive = 8,
    /// No active dissolution vote exists
    NoActiveVote = 9,
    /// Member has already cast their vote
    AlreadyVoted = 10,
    /// Circle is not in the required state for this operation
    CircleNotActive = 11,
    /// Circle has already been dissolved
    CircleAlreadyDissolved = 12,
    /// Circle has reached maximum member capacity
    CircleAtCapacity = 13,
    /// Circle is in emergency panic state
    CirclePanicked = 14,
    /// Oracle price data is unavailable
    PriceUnavailable = 15,
    /// Arithmetic operation would overflow
    ArithmeticOverflow = 16,
        Paused = 17,
}

// ── Data Structures ───────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleData {
    /// Address of the circle organizer (admin)
    pub organizer: Address,
    /// Token contract address (e.g., USDC, XLM)
    pub token_address: Address,
    /// Required contribution amount per round
    pub contribution_amount: i128,
    /// Duration of each round in days
    pub frequency_days: u32,
    /// Total number of rounds in the circle lifecycle
    pub max_rounds: u32,
    /// Current active round number (1-indexed)
    pub current_round: u32,
    /// Current number of active members
    pub member_count: u32,
    /// Maximum allowed members
    pub max_members: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberData {
    /// Member's wallet address
    pub address: Address,
    /// Cumulative amount contributed to the circle
    pub total_contributed: i128,
    /// Cumulative amount withdrawn from the circle
    pub total_withdrawn: i128,
    /// Whether member has received their scheduled payout
    pub has_received_payout: bool,
    /// Member status: 0 = Active, 1 = Inactive, 2 = Exited
    pub status: u32,
}

/// Circle lifecycle status
///
/// Represents the current operational state of the circle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CircleStatus {
    /// Normal operation - contributions and payouts active
    Active,
    /// Dissolution vote in progress
    VotingForDissolution,
    /// Circle dissolved via governance vote
    Dissolved,
    /// Emergency state - only refunds allowed
    Panicked,
}

/// Tracks an in-progress dissolution vote
///
/// Stores voting state during the dissolution process.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionVote {
    /// Number of votes in favor of dissolution
    pub votes_for: u32,
    /// Total number of eligible voting members
    pub total_members: u32,
    /// Threshold mode: 0 = simple majority (>50%), 1 = supermajority (>66%)
    pub threshold_mode: u32,
}

/// Member standing and activity tracking
///
/// Monitors member participation and eligibility status.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberStanding {
    /// Number of consecutive missed contribution rounds
    pub missed_count: u32,
    /// Whether member is currently active (not disqualified)
    pub is_active: bool,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

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

// ── Contract ──────────────────────────────────────────────────────────────────

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

    pub fn claim_payout(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
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

        let payout = (circle.member_count as i128) * circle.contribution_amount;

        member_data.total_withdrawn = member_data
            .total_withdrawn
            .checked_add(payout)
            .ok_or(AjoError::ArithmeticOverflow)?;
        member_data.has_received_payout = true;

        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

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
}
    /// Calculate 10^exp with overflow checking
    ///
    /// # Arguments
    /// * `exp` - Exponent value
    ///
    /// # Returns
    /// * `Ok(i128)` - Result of 10^exp
    /// * `Err(AjoError::ArithmeticOverflow)` if overflow occurs
    fn pow10_checked(exp: u32) -> Result<i128, AjoError> {
        let mut result: i128 = 1;
        let mut i: u32 = 0;
        while i < exp {
            result = result
                .checked_mul(10)
                .ok_or(AjoError::ArithmeticOverflow)?;
            i += 1;
        }
        Ok(result)
    }

    /// Initialize a new Ajo circle
    ///
    /// Creates a new savings circle with specified parameters. The organizer
    /// becomes the first member and administrator.
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `organizer` - Address of the circle creator (becomes admin)
    /// * `token_address` - Address of the token contract to use (e.g., USDC)
    /// * `contribution_amount` - Required contribution per round
    /// * `frequency_days` - Duration of each round in days
    /// * `max_rounds` - Total number of rounds in the circle
    /// * `max_members` - Maximum number of members (0 = use default)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(AjoError::InvalidInput)` if parameters are invalid
    ///
    /// # Requirements
    /// - Caller must be the organizer
    /// - All numeric parameters must be positive
    /// - max_members must not exceed HARD_CAP
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

        let configured_max_members = if max_members == 0 {
            MAX_MEMBERS
        } else {
            max_members
        };

        if contribution_amount <= 0
            || frequency_days == 0
            || max_rounds == 0
            || configured_max_members == 0
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
        env.storage().instance().set(&DataKey::Admin, &organizer);
        env.storage().instance().set(&DataKey::RoundContribCount, &0_u32);

        // Set first round deadline: now + frequency_days converted to seconds
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
        standings.set(
            organizer.clone(),
            MemberStanding {
                missed_count: 0,
                is_active: true,
            },
        );
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    /// Join an existing circle as a new member
    ///
    /// Adds a new member to the circle. Only the organizer can add members.
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `organizer` - Address of the circle organizer
    /// * `new_member` - Address of the member to add
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(AjoError::Unauthorized)` if caller is not the organizer
    /// * `Err(AjoError::AlreadyExists)` if member already in circle
    /// * `Err(AjoError::CircleAtCapacity)` if circle is full
    /// * `Err(AjoError::CirclePanicked)` if circle is in emergency state
    ///
    /// # Requirements
    /// - Caller must be the organizer
    /// - Member must not already exist
    /// - Circle must not be at capacity
    /// - Circle must not be in panic state
    pub fn join_circle(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        // Block joins during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

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

        circle.member_count = circle
            .member_count
            .checked_add(1)
            .ok_or(AjoError::InvalidInput)?;

        let mut standings: Map<Address, MemberStanding> = env.storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));
        
        standings.set(
            new_member.clone(),
            MemberStanding {
                missed_count: 0,
                is_active: true,
            },
        );

        env.storage().instance().set(&DataKey::Members, &members);
        env.storage().instance().set(&DataKey::Circle, &circle);
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    /// Backward-compatible wrapper for joining the circle
    ///
    /// Alias for `join_circle` to maintain API compatibility.
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `organizer` - Address of the circle organizer
    /// * `new_member` - Address of the member to add
    ///
    /// # Returns
    /// Same as `join_circle`
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    /// Record a contribution from a member
    ///
    /// Allows a member to contribute tokens to the circle. Transfers tokens
    /// from the member to the contract and updates their contribution balance.
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `member` - Address of the contributing member
    /// * `amount` - Amount of tokens to contribute
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(AjoError::InvalidInput)` if amount <= 0
    /// * `Err(AjoError::NotFound)` if member not in circle
    /// * `Err(AjoError::Disqualified)` if member is inactive
    /// * `Err(AjoError::CirclePanicked)` if circle is in emergency state
    ///
    /// # Requirements
    /// - Caller must be the member
    /// - Amount must be positive
    /// - Member must be active (not disqualified)
    /// - Circle must not be in panic state
    ///
    /// # Side Effects
    /// - Resets member's missed contribution count
    /// - May advance to next round if all members have contributed
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        member.require_auth();

        if Self::is_paused(&env) {
    return Err(AjoError::Paused);
}

        // Block contributions during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let mut standings: Map<Address, MemberStanding> = env.storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));

        if let Some(mut standing) = standings.get(member.clone()) {
            if standing.missed_count >= 3 {
                panic!("Member disqualified due to inactivity.");
            }
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
            // Reset missed count on successful contribution
            standing.missed_count = 0;
            standings.set(member.clone(), standing);
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Standings, &standings);

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            let round_target = (circle.current_round as i128)
                .checked_mul(circle.contribution_amount)
                .ok_or(AjoError::ArithmeticOverflow)?;
            let had_completed_round = member_data.total_contributed >= round_target;

            // Transfer tokens from member to contract
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&member, &env.current_contract_address(), &amount);

            member_data.total_contributed = member_data
                .total_contributed
                .checked_add(amount)
                .ok_or(AjoError::ArithmeticOverflow)?;

            let has_completed_round = member_data.total_contributed >= round_target;

            members.set(member.clone(), member_data);

            if !had_completed_round && has_completed_round {
                let mut round_contrib_count: u32 = env
                    .storage()
                    .instance()
                    .get(&DataKey::RoundContribCount)
                    .unwrap_or(0_u32);

                round_contrib_count = round_contrib_count
                    .checked_add(1)
                    .ok_or(AjoError::ArithmeticOverflow)?;

                if round_contrib_count >= circle.member_count {
                    let deadline: u64 = env
                        .storage()
                        .instance()
                        .get(&DataKey::RoundDeadline)
                        .unwrap_or(0);
                    let next_deadline = deadline + (circle.frequency_days as u64) * 86_400;
                    env.storage().instance().set(&DataKey::RoundDeadline, &next_deadline);

                    if circle.current_round < circle.max_rounds {
                        circle.current_round += 1;
                    }

                    round_contrib_count = 0;
                    env.storage().instance().set(&DataKey::Circle, &circle);
                }

                env.storage()
                    .instance()
                    .set(&DataKey::RoundContribCount, &round_contrib_count);
            }
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Members, &members);

        Ok(())
    }

    /// Deposit exactly the configured periodic contribution amount in the circle token.
    /// Records the ledger timestamp for the member and increments the tracked pool balance.
    pub fn deposit(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        if Self::is_paused(&env) {
    return Err(AjoError::Paused);
}

        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let amount = circle.contribution_amount;
        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let mut standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));

        if let Some(mut standing) = standings.get(member.clone()) {
            if standing.missed_count >= 3 {
                panic!("Member disqualified due to inactivity.");
            }
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
            standing.missed_count = 0;
            standings.set(member.clone(), standing);
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Standings, &standings);

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&member, &env.current_contract_address(), &amount);

            member_data.total_contributed += amount;
            members.set(member.clone(), member_data);
        } else {
            return Err(AjoError::NotFound);
        }

        let ts = env.ledger().timestamp();
        let mut last_deposits: Map<Address, u64> = env
            .storage()
            .instance()
            .get(&DataKey::LastDepositAt)
            .unwrap_or_else(|| Map::new(&env));
        last_deposits.set(member.clone(), ts);
        env.storage().instance().set(&DataKey::LastDepositAt, &last_deposits);

        let mut pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        pool = pool.checked_add(amount).ok_or(AjoError::InvalidInput)?;
        env.storage().instance().set(&DataKey::TotalPool, &pool);

        env.storage().instance().set(&DataKey::Members, &members);

        let round_contributions = members
            .iter()
            .filter(|(_, m)| {
                m.total_contributed >= (circle.current_round as i128) * circle.contribution_amount
            })
            .count() as u32;

        if round_contributions >= circle.member_count {
            let deadline: u64 = env
                .storage()
                .instance()
                .get(&DataKey::RoundDeadline)
                .unwrap_or(0);
            let next_deadline = deadline + (circle.frequency_days as u64) * 86_400;
            env.storage()
                .instance()
                .set(&DataKey::RoundDeadline, &next_deadline);
        }

        // Emit DepositReceived event
        env.events().publish(
            (symbol_short!("deposit"), member.clone()),
            (amount, circle.current_round)
        );

        Ok(())
    }

    /// Running total of tokens received through `deposit` (tracked in instance storage).
    pub fn get_total_pool(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0)
    }

    /// Last `deposit` timestamp for a member, if any.
    pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError> {
        let m: Map<Address, u64> = env
            .storage()
            .instance()
            .get(&DataKey::LastDepositAt)
            .ok_or(AjoError::NotFound)?;
        m.get(member).ok_or(AjoError::NotFound)
    }

    /// Shuffle the payout rotation order using ledger sequence as seed (Fisher-Yates).
    /// Must be called by the organizer before the first round begins.
    pub fn shuffle_rotation(env: Env, organizer: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        let circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

        // Block shuffle during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        let members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        // Build ordered list from current members
        let mut rotation: Vec<Address> = Vec::new(&env);
        for (addr, _) in members.iter() {
            rotation.push_back(addr);
        }

        let n = rotation.len();
        if n < 2 {
            env.storage().instance().set(&DataKey::RotationOrder, &rotation);
            return Ok(());
        }

        // Seed: mix ledger sequence with tx hash bytes for unpredictability
        let ledger_seq = env.ledger().sequence();
        let tx_hash: BytesN<32> = env.crypto().sha256(
            &soroban_sdk::Bytes::from_slice(&env, &ledger_seq.to_be_bytes())
        ).into();
        let hash_bytes = tx_hash.to_array();

        // Fisher-Yates shuffle — seed advances through hash bytes cyclically
        for i in (1..n).rev() {
            let byte_idx = (i as usize) % 32;
            let j = (hash_bytes[byte_idx] as u32) % (i + 1);
            // Swap rotation[i] and rotation[j]
            let a = rotation.get(i).unwrap();
            let b = rotation.get(j).unwrap();
            rotation.set(i, b);
            rotation.set(j, a);
        }

        env.storage().instance().set(&DataKey::RotationOrder, &rotation);

        Ok(())
    }

    /// Slash a member for missing a contribution round
    pub fn slash_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        let mut standings: Map<Address, MemberStanding> = env.storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));

        if let Some(mut standing) = standings.get(member.clone()) {
            standing.missed_count += 1;
            if standing.missed_count >= 3 {
                standing.is_active = false;
            }
            standings.set(member.clone(), standing);
            env.storage().instance().set(&DataKey::Standings, &standings);
            Ok(())
        } else {
            Err(AjoError::NotFound)
        }
    }

    /// Update off-chain KYC tie for a member. Admin-only.
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

    /// Remove a dormant user from active standing. Admin-only.
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
            .unwrap_or(Map::new(&env));

        if let Some(mut standing) = standings.get(member.clone()) {
            standing.is_active = false;
            standings.set(member.clone(), standing);
        } else {
            return Err(AjoError::NotFound);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            member_data.status = 2;
            members.set(member, member_data);
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Standings, &standings);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(())
    }

    /// Upgrade the contract's WASM code. Restricted to admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    /// Claim payout when it's a member's turn
    /// REENTRANCY PROTECTED: Follows Checks-Effects-Interactions pattern
    pub fn claim_payout(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        if Self::is_paused(&env) {
    return Err(AjoError::Paused);
}

        // CHECKS: Validate all conditions first
        // Block payouts during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        // Validate cycle is within valid range
        if cycle == 0 || cycle > circle.max_rounds {
            return Err(AjoError::InvalidInput);
        }

        // Check member standing
        let standings: Map<Address, MemberStanding> = env.storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));

        if let Some(standing) = standings.get(member.clone()) {
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
        }

        // Verify cycle has matured (time check)
        let current_time = env.ledger().timestamp();
        let cycle_deadline = Self::get_cycle_deadline(&env, cycle)?;
        
        if current_time < cycle_deadline {
            return Err(AjoError::InvalidInput); // Cycle not yet mature
        }

        // Verify pool is fully funded for this cycle
        let required_pool = (circle.member_count as i128) * circle.contribution_amount;
        if !Self::is_cycle_fully_funded(&env, cycle, required_pool)? {
            return Err(AjoError::InsufficientFunds);
        }

        // Enforce rotation order - verify member is designated recipient for this cycle
        if let Some(rotation) = env.storage()
            .instance()
            .get::<DataKey, Vec<Address>>(&DataKey::RotationOrder)
        {
            let idx = (cycle - 1) as u32;
            let expected = rotation.get(idx).ok_or(AjoError::InvalidInput)?;
            if expected != member {
                return Err(AjoError::Unauthorized);
            }
        } else {
            return Err(AjoError::InvalidInput); // Rotation not set
        }

        // Check if already withdrawn for this cycle
        let mut cycle_withdrawals: Map<u32, Map<Address, bool>> = env
            .storage()
            .instance()
            .get(&DataKey::CycleWithdrawals)
            .unwrap_or(Map::new(&env));

        let mut cycle_map = cycle_withdrawals
            .get(cycle)
            .unwrap_or(Map::new(&env));

        if cycle_map.get(member.clone()).unwrap_or(false) {
            return Err(AjoError::AlreadyPaid);
        }

            // EFFECTS: Update state BEFORE external call
            member_data.has_received_payout = true;
            member_data.total_withdrawn += payout;

            members.set(member.clone(), member_data);
            env.storage().instance().set(&DataKey::Members, &members);
        } else {
            return Err(AjoError::NotFound);
        }

        // Safe transfer: Execute AFTER state updates (reentrancy protection)
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &payout);

        Ok(payout)
    }

    /// Helper: Calculate deadline for a specific cycle
    fn get_cycle_deadline(env: &Env, cycle: u32) -> Result<u64, AjoError> {
        let circle: CircleData = env
            .storage()
            .instance()
            .get(&Da
