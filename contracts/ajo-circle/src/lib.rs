//! # Ajo Circle Smart Contract
//! Decentralized ROSCA implementation on Stellar (Soroban)

#![no_std]

pub mod factory;

#[cfg(test)]
mod deposit_tests;

#[cfg(test)]
mod withdrawal_tests;

#[cfg(test)]
mod penalty_tests;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Symbol, Vec, BytesN,
};




pub const MAX_MEMBERS: u32 = 50;
pub const HARD_CAP: u32 = 100;
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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionVote {
    /// Number of votes in favor of dissolution
    pub votes_for: u32,
    /// Total number of eligible voting members
    pub total_members: u32,
    /// 0 = simple majority (>50%), 1 = supermajority (>66%)
    pub threshold_mode: u32,
}

/// Member standing and activity tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberStanding {
    /// Number of consecutive missed contribution rounds
    pub missed_count: u32,
    /// Whether member is currently active (not disqualified)
    pub is_active: bool,
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
    FeeConfig,
    /// Tracks addresses that have already cast a dissolution vote
    VotedMembers,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    // ---------------- INTERNAL HELPERS ----------------
    
    /// Deterministic Fisher-Yates shuffle using a simple LCG.
    /// This is a pure function, invariant and bijective.
    fn deterministic_shuffle<T>(list: &mut [T], mut seed: u64) {
        if list.is_empty() {
            return;
        }
        for i in (1..list.len()).rev() {
            // Simple LCG: x = (a*x + c) % m
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let j = (seed % (i as u64 + 1)) as usize;
            list.swap(i, j);
        }
    }

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
        let status: CircleStatus = env.storage().instance().get(&DataKey::CircleStatus).unwrap_or(CircleStatus::Active);
        status == CircleStatus::Panicked
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

    // ---------------- PAYOUT ----------------

    /// Claim the rotating payout for the current cycle.
    ///
    /// # Security Ã¢â‚¬â€ Checks-Effects-Interactions (CEI)
    ///
    /// Soroban's execution model is single-threaded and does not have
    /// Ethereum-style reentrancy, but we still follow CEI strictly:
    ///
    ///   CHECKS     Ã¢â‚¬â€ auth, pause, panic, member exists, not already paid,
    ///                standing active, rotation order enforced, pool funded
    ///   EFFECTS    Ã¢â‚¬â€ mark payout, accumulate total_withdrawn, persist state
    ///   INTERACTIONS Ã¢â‚¬â€ token transfer executed last
    ///
    /// The `has_received_payout` flag is set to `true` and persisted before
    /// the token transfer, so any hypothetical re-entry would be rejected by
    /// the `AlreadyPaid` check.
    pub fn claim_payout(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        // Ã¢â€â‚¬Ã¢â€â‚¬ CHECKS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

        let mut members = Self::load_members(&env)?;
        if members.contains_key(new_member.clone()) { return Err(AjoError::AlreadyExists); }
        if circle.member_count >= circle.max_members { return Err(AjoError::CircleAtCapacity); }

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

        // Ã¢â€â‚¬Ã¢â€â‚¬ EFFECTS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

        // Ã¢â€â‚¬Ã¢â€â‚¬ INTERACTIONS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &payout);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (payout, cycle, circle.current_round)
        );

        Ok(payout)
    }

    pub fn withdraw(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        Self::claim_payout(env, member, cycle)
    }

    /// Emergency partial withdrawal: exit the circle with a penalty.
    pub fn partial_withdraw(env: Env, member: Address) -> Result<i128, AjoError> {
        Self::require_not_paused(&env)?;
        member.require_auth();
        Self::require_not_panicked(&env)?;

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

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let net_contributed = member_data.total_contributed - member_data.total_withdrawn;
        let penalty = (net_contributed as u128 * WITHDRAWAL_PENALTY_PERCENT as u128 / 100) as i128;
        let refund = net_contributed - penalty;

        member_data.total_withdrawn += refund;
        member_data.status = 2; // Exited
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        let new_pool = pool.checked_sub(refund).ok_or(AjoError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::TotalPool, &new_pool);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (refund, circle.current_round)
        );

        Ok(refund)
    }

    // ---------------- GOVERNANCE ----------------

    pub fn start_dissolution_vote(env: Env, caller: Address, threshold_mode: u32) -> Result<(), AjoError> {
        caller.require_auth();

        if threshold_mode > 1 {
            return Err(AjoError::InvalidInput);
        }

        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active);

        if status != CircleStatus::Active {
            return Err(AjoError::VoteAlreadyActive);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let vote = DissolutionVote {
            votes_for: 0,
            total_members: circle.member_count,
            threshold_mode,
        };

        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::VotingForDissolution);
        env.storage().instance().set(&DataKey::CycleWithdrawals, &vote); // Reuse key for vote tracking

        env.events().publish(
            (symbol_short!("dissolve"), symbol_short!("start"), env.current_contract_address()),
            (threshold_mode, env.ledger().timestamp())
        );

        Ok(())
    }

    pub fn vote_to_dissolve(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        let members_map: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;
        if !members_map.contains_key(member.clone()) {
            return Err(AjoError::Unauthorized);
        }

        let mut status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .ok_or(AjoError::NotFound)?;

        if status != CircleStatus::VotingForDissolution {
            return Err(AjoError::NoActiveVote);
        }
        env.storage().instance().set(&DataKey::Members, &members);

        let mut vote: DissolutionVote = env
            .storage()
            .instance()
            .get(&DataKey::CycleWithdrawals)
            .ok_or(AjoError::NoActiveVote)?;

        // Track who voted to prevent double voting
        let mut voted_members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::VotedMembers)
            .unwrap_or_else(|| Vec::new(&env));
        
        for i in 0..voted_members.len() {
            if voted_members.get(i).unwrap() == member {
                return Err(AjoError::AlreadyVoted);
            }
        }

        voted_members.push_back(member.clone());
        env.storage().instance().set(&DataKey::VotedMembers, &voted_members);

        vote.votes_for += 1;
        
        let threshold_met = if vote.threshold_mode == 0 {
            vote.votes_for * 2 > vote.total_members
        } else {
            vote.votes_for * 100 > vote.total_members * 66
        };

        if threshold_met {
            status = CircleStatus::Dissolved;
            env.storage().instance().set(&DataKey::CircleStatus, &status);
            
            env.events().publish(
                (symbol_short!("dissolve"), symbol_short!("passed"), env.current_contract_address()),
                env.ledger().timestamp()
            );
        } else {
            env.storage().instance().set(&DataKey::CycleWithdrawals, &vote);
        }

        // Also update member status to Exited (2)
        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            member_data.status = 2; // Exited
            members.set(member.clone(), member_data);
            env.storage().instance().set(&DataKey::Members, &members);
        }

        env.events().publish(
            (symbol_short!("vote_cast"), member.clone(), env.current_contract_address()),
            (1u32, vote.votes_for) // 1 = YES
        );

        Ok(())
    }

    pub fn dissolve_and_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .ok_or(AjoError::NotFound)?;

        if status != CircleStatus::Dissolved {
            return Err(AjoError::CircleNotActive);
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

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        
        member_data.total_withdrawn += refund;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (refund, circle.current_round)
        );

        Ok(refund)
    }

    pub fn emergency_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        if !Self::is_paused(&env) {
            return Err(AjoError::CircleNotActive);
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

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        
        member_data.total_withdrawn += refund;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (refund, circle.current_round)
        );

        Ok(refund)
    }

    // ---------------- ADMIN ----------------

    pub fn panic(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Panicked);
        env.events().publish(
            ((symbol_short!("panic"),), admin.clone()),
            env.ledger().timestamp(),
        );
        Ok(())
    }

    pub fn resume(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Active);
        env.events().publish(
            (symbol_short!("resume"), admin.clone(), env.current_contract_address()),
            env.ledger().timestamp()
        );
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
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Panicked);
        env.events().publish(
            (symbol_short!("panic"),),
            (caller, env.ledger().timestamp()),
        );
        Ok(())
    }


    // ---------------- ROLE MANAGEMENT ----------------

    pub fn grant_role(env: Env, caller: Address, role: Symbol, new_member: Address) -> Result<(), AjoError> {
        Self::require_deployer(&env, &caller)?;

        if role != ADMIN_ROLE && role != MANAGER_ROLE {
            return Err(AjoError::InvalidInput);
        }

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

        if role != ADMIN_ROLE && role != MANAGER_ROLE {
            return Err(AjoError::InvalidInput);
        }

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
                (symbol_short!("role_rvk"), member, env.current_contract_address()),
                (role, env.ledger().timestamp()),
            );
        }

        Ok(())
    }

    pub fn has_role(env: Env, role: Symbol, member: Address) -> bool {
        Self::has_role_internal(&env, role, &member)
    }

    pub fn get_deployer(env: Env) -> Result<Address, AjoError> {
        env.storage().instance().get(&DataKey::Deployer).ok_or(AjoError::NotFound)
    }

    // ---------------- QUERIES ----------------


    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError> {
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;
        members.get(member).ok_or(AjoError::NotFound)
    }


    pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError> {
        env.storage().instance().get(&DataKey::Circle).ok_or(AjoError::NotFound)
    }

    pub fn get_fee_config(env: Env) -> Option<FeeConfig> {
        env.storage().instance().get(&DataKey::FeeConfig)
    }

    /// Update the global fee configuration. Restricted to admin/deployer.
    ///
    /// # Security
    /// Guarded by `require_admin` — unauthorized callers receive
    /// `AjoError::Unauthorized`. Soroban's `require_auth()` inside
    /// `require_admin` ensures the transaction is signed by `admin`.
    ///
    /// # Arguments
    /// * `admin`       - Address of the caller (must hold ADMIN role or be deployer)
    /// * `treasury`    - Address that receives collected fees
    /// * `fee_bps`     - Fee in basis points (e.g. 100 = 1%). Max 1000 (10%).
    pub fn set_fee_config(
        env: Env,
        admin: Address,
        treasury: Address,
        fee_bps: u32,
    ) -> Result<(), AjoError> {
        // ── AUTH CHECK ──────────────────────────────────────────────────────
        // require_admin calls admin.require_auth() internally, so the tx must
        // be signed by `admin`. Any unsigned or wrong-signer call panics here.
        Self::require_admin(&env, &admin)?;

        // Sanity-check: cap fee at 10% (1000 bps) to prevent accidental drain.
        if fee_bps > 1000 {
            return Err(AjoError::InvalidInput);
        }

        let config = FeeConfig { treasury, fee_bps };
        env.storage().instance().set(&DataKey::FeeConfig, &config);

        env.events().publish(
            (symbol_short!("fee_set"), admin),
            (fee_bps, env.ledger().timestamp()),
        );

        Ok(())
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

        if contribution_amount < MIN_CONTRIBUTION_AMOUNT as i128
            || contribution_amount > MAX_CONTRIBUTION_AMOUNT as i128
            || frequency_days < MIN_FREQUENCY_DAYS
            || frequency_days > MAX_FREQUENCY_DAYS
            || max_rounds < MIN_ROUNDS
            || max_rounds > MAX_ROUNDS
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
        // Store organizer as the deployer/owner so require_admin and
        // require_deployer guards are functional from the first call onward.
        env.storage().instance().set(&DataKey::Deployer, &organizer);
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
        Self::require_not_paused(&env)?;

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
                return Err(AjoError::Disqualified);
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
                return Err(AjoError::Disqualified);
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
        Self::require_not_paused(&env)?;

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

        // Fisher-Yates shuffle Ã¢â‚¬â€ seed advances through hash bytes cyclically
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

        let members_check: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;
        if !members_check.contains_key(member.clone()) {
            return Err(AjoError::NotFound);
        }

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
            if standing.is_active && standing.missed_count < 3 {
                return Err(AjoError::InvalidInput);
            }
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
}
    #[test]
    fn test_deposit_exact_contribution_updates_pool_and_timestamp() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _organizer, member, _token) = setup_circle_with_member(&env);

        assert_eq!(client.get_total_pool(), 0);
        assert_eq!(client.deposit(&member), Ok(()));
        assert_eq!(client.get_total_pool(), 100_i128);
        assert!(client.get_last_deposit_timestamp(&member).is_ok());
    }

    // ── contribute() unit tests ───────────────────────────────────────────────

    /// Shared fixture: fresh circle with `contribution_amount = 100`, `max_rounds = 3`,
    /// `max_members = 3`. Returns (client, organizer, member_b, member_c, token_address).
    /// No contributions have been made yet.
    fn setup_contribute(
        env: &Env,
    ) -> (AjoCircleClient<'_>, Address, Address, Address, Address) {
        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(env, &contract_id);

        let admin = Address::generate(env);
        let organizer = Address::generate(env);
        let member_b = Address::generate(env);
        let member_c = Address::generate(env);

        let token_address = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address);

        // Mint enough for several rounds each
        token_admin.mint(&organizer, &10_000_i128);
        token_admin.mint(&member_b, &10_000_i128);
        token_admin.mint(&member_c, &10_000_i128);

        // contribution_amount=100, frequency_days=7, max_rounds=3, max_members=3
        client.initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &3_u32, &3_u32);
        client.add_member(&organizer, &member_b);
        client.add_member(&organizer, &member_c);

        (client, organizer, member_b, member_c, token_address)
    }

    // ── Error paths ───────────────────────────────────────────────────────────

    #[test]
    fn contribute_rejects_zero_amount() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        assert_eq!(client.contribute(&organizer, &0_i128), Err(AjoError::InvalidInput));
    }

    #[test]
    fn contribute_rejects_negative_amount() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        assert_eq!(client.contribute(&organizer, &-1_i128), Err(AjoError::InvalidInput));
    }

    #[test]
    fn contribute_blocked_when_panicked() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, _, _) = setup_contribute(&env);

        client.panic(&organizer);
        assert_eq!(client.contribute(&member_b, &100_i128), Err(AjoError::CirclePanicked));
    }

    #[test]
    fn contribute_rejects_non_member() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _, _, _, _) = setup_contribute(&env);

        // stranger was never added to the circle
        let stranger = Address::generate(&env);
        assert_eq!(client.contribute(&stranger, &100_i128), Err(AjoError::NotFound));
    }

    #[test]
    fn contribute_rejects_member_with_missed_count_at_threshold() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, _, _) = setup_contribute(&env);

        // Slash member_b three times to hit the disqualification threshold
        client.slash_member(&organizer, &member_b);
        client.slash_member(&organizer, &member_b);
        client.slash_member(&organizer, &member_b);

        assert_eq!(client.contribute(&member_b, &100_i128), Err(AjoError::Disqualified));
    }

    #[test]
    fn contribute_rejects_inactive_member() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, _, _) = setup_contribute(&env);

        // boot_dormant_member sets is_active = false directly
        client.boot_dormant_member(&organizer, &member_b);

        assert_eq!(client.contribute(&member_b, &100_i128), Err(AjoError::Disqualified));
    }

    // ── Partial contribution (below round target) ─────────────────────────────

    #[test]
    fn contribute_partial_accumulates_without_advancing_round() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        // Round target for round 1 = 1 * 100 = 100. Pay only 50.
        assert_eq!(client.contribute(&organizer, &50_i128), Ok(()));

        let state = client.get_circle_state().unwrap();
        assert_eq!(state.current_round, 1, "round must not advance on partial payment");

        let balance = client.get_member_balance(&organizer).unwrap();
        assert_eq!(balance.total_contributed, 50_i128);

        // RoundContribCount must still be 0 (organizer hasn't crossed the threshold yet)
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);
        assert_eq!(count, 0);
    }

    #[test]
    fn contribute_partial_debits_token_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, token_address) = setup_contribute(&env);
        let token_client = token::Client::new(&env, &token_address);

        let before = token_client.balance(&organizer);
        client.contribute(&organizer, &40_i128);
        assert_eq!(token_client.balance(&organizer), before - 40);
    }

    // ── Exact / completing contribution ───────────────────────────────────────

    #[test]
    fn contribute_exact_amount_marks_member_as_completed_for_round() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        assert_eq!(client.contribute(&organizer, &100_i128), Ok(()));

        let balance = client.get_member_balance(&organizer).unwrap();
        assert_eq!(balance.total_contributed, 100_i128);

        // One member completed; count should be 1 (3 members total, round not yet advanced)
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);
        assert_eq!(count, 1);

        // Round still 1 — not all members have contributed
        assert_eq!(client.get_circle_state().unwrap().current_round, 1);
    }

    #[test]
    fn contribute_over_amount_still_counts_as_round_completion() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        // Pay 150 when target is 100 — should still flip the "completed" flag
        assert_eq!(client.contribute(&organizer, &150_i128), Ok(()));

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);
        assert_eq!(count, 1);
    }

    // ── Round advancement ─────────────────────────────────────────────────────

    #[test]
    fn contribute_all_members_complete_round_advances() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, member_c, _) = setup_contribute(&env);

        // All three members contribute the exact round amount
        client.contribute(&organizer, &100_i128);
        client.contribute(&member_b, &100_i128);

        // Still round 1 after two of three
        assert_eq!(client.get_circle_state().unwrap().current_round, 1);

        // Third member tips it over
        client.contribute(&member_c, &100_i128);

        let state = client.get_circle_state().unwrap();
        assert_eq!(state.current_round, 2, "round must advance when all members complete");

        // Counter must reset to 0 after round advance
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);
        assert_eq!(count, 0);
    }

    #[test]
    fn contribute_round_advance_extends_deadline() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, member_c, _) = setup_contribute(&env);

        let deadline_before: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RoundDeadline)
            .unwrap_or(0);

        client.contribute(&organizer, &100_i128);
        client.contribute(&member_b, &100_i128);
        client.contribute(&member_c, &100_i128);

        let deadline_after: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RoundDeadline)
            .unwrap_or(0);

        // frequency_days = 7 → 7 * 86_400 = 604_800 seconds added
        assert_eq!(deadline_after, deadline_before + 604_800);
    }

    // ── Final round boundary ──────────────────────────────────────────────────

    #[test]
    fn contribute_does_not_advance_past_max_rounds() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, member_c, _) = setup_contribute(&env);

        // max_rounds = 3; complete all three rounds
        for _ in 0..3 {
            client.contribute(&organizer, &100_i128);
            client.contribute(&member_b, &100_i128);
            client.contribute(&member_c, &100_i128);
        }

        let state = client.get_circle_state().unwrap();
        assert_eq!(state.current_round, 3, "current_round must not exceed max_rounds");
    }

    // ── Missed-count reset ────────────────────────────────────────────────────

    #[test]
    fn contribute_resets_missed_count_on_success() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, _, _) = setup_contribute(&env);

        // Give member_b two strikes (below the disqualification threshold of 3)
        client.slash_member(&organizer, &member_b);
        client.slash_member(&organizer, &member_b);

        // Successful contribution must reset missed_count to 0
        assert_eq!(client.contribute(&member_b, &100_i128), Ok(()));

        let standings: Map<Address, MemberStanding> = env
            .storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap();
        let standing = standings.get(member_b).unwrap();
        assert_eq!(standing.missed_count, 0);
    }

    // ── Idempotency of the "already completed" guard ──────────────────────────

    #[test]
    fn contribute_second_payment_in_same_round_does_not_double_count() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _, _, _) = setup_contribute(&env);

        // First payment completes the round for organizer
        client.contribute(&organizer, &100_i128);

        let count_after_first: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);

        // Second payment in the same round — organizer already crossed the threshold
        client.contribute(&organizer, &50_i128);

        let count_after_second: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RoundContribCount)
            .unwrap_or(0);

        assert_eq!(
            count_after_first, count_after_second,
            "RoundContribCount must not increment again for the same member in the same round"
        );
    }

    // ── Token accounting ──────────────────────────────────────────────────────

    #[test]
    fn contribute_full_round_debits_correct_token_amounts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member_b, member_c, token_address) = setup_contribute(&env);
        let token_client = token::Client::new(&env, &token_address);

        let org_before = token_client.balance(&organizer);
        let b_before = token_client.balance(&member_b);
        let c_before = token_client.balance(&member_c);

        client.contribute(&organizer, &100_i128);
        client.contribute(&member_b, &100_i128);
        client.contribute(&member_c, &100_i128);

        assert_eq!(token_client.balance(&organizer), org_before - 100);
        assert_eq!(token_client.balance(&member_b), b_before - 100);
        assert_eq!(token_client.balance(&member_c), c_before - 100);
    }
}
