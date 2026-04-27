//! # Ajo Circle Smart Contract
//! Decentralized ROSCA implementation on Stellar (Soroban)

#![no_std]

pub mod factory;
pub mod events;

#[cfg(test)]
mod deposit_tests;

#[cfg(test)]
mod withdrawal_tests;

#[cfg(test)]
mod penalty_tests;

#[cfg(test)]
mod test;

#[cfg(test)]
mod timelock_tests;

#[cfg(test)]
mod interest_tests;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Symbol, Vec, BytesN,
};
use crate::events::{
    CircleInitEvent, MemberEvent, ContributionEvent, ContributionPayload, WithdrawalEvent,
    PartialWithdrawalEvent, EmergencyRefundEvent, VoteEvent, DissolutionEvent,
    StatusChangeEvent, RoleEvent, FeeConfigEvent, MemberRemovedEvent, CircleClosedEvent,
    emit_circle_initialized, emit_member_added, emit_contribution, emit_deposit,
    emit_payout, emit_partial_withdrawal, emit_emergency_refund,
    emit_dissolution_started, emit_dissolution_passed, emit_vote_cast,
    emit_panic, emit_resume, emit_role_granted, emit_role_revoked,
    emit_fee_config, emit_status_change, emit_member_removed, emit_circle_closed,
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
pub const UPGRADE_TIMELOCK_SECONDS: u64 = 48 * 3600; // 48 hours
// LIMIT_SYNC_TAG: v1.0.2

// ---------------- ROLE CONSTANTS ----------------
const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MANAGER_ROLE: Symbol = symbol_short!("MANAGER");

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
    Paused = 17,
    TimelockNotReady = 18,
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
pub enum CircleStatus {
    Active,
    VotingForDissolution,
    Dissolved,
    Panicked,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionVote {
    pub votes_for: u32,
    pub total_members: u32,
    pub threshold_mode: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberStanding {
    pub missed_count: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub treasury: Address,
    pub fee_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimelockProposal {
    pub new_wasm_hash: BytesN<32>,
    pub unlock_time: u64,
}

#[contracttype]
pub enum DataKey {
    Circle,
    /// Vec<Address> — ordered member list (used for iteration/shuffle only)
    Members,
    Admin,
    CircleStatus,
    RotationOrder,
    RoundDeadline,
    RoundContribCount,
    TotalPool,
    CycleWithdrawals,
    RoleMembers,
    Deployer,
    FeeConfig,
    VotedMembers,
    /// Per-member data — O(1) direct access
    Member(Address),
    /// Per-member standing — O(1) direct access
    Standing(Address),
    /// Per-member last deposit timestamp — O(1) direct access
    LastDeposit(Address),
    /// Per-member KYC status — O(1) direct access
    KycVerified(Address),
    /// Pending WASM upgrade proposal (timelock)
    PendingUpgrade,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    // ---------------- INTERNAL HELPERS ----------------

    fn deterministic_shuffle<T>(list: &mut [T], mut seed: u64) {
        if list.is_empty() {
            return;
        }
        for i in (1..list.len()).rev() {
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
        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active);
        status == CircleStatus::Panicked
    }

    fn require_not_paused(env: &Env) -> Result<(), AjoError> {
        if Self::is_paused(env) {
            Err(AjoError::CirclePanicked)
        } else {
            Ok(())
        }
    }

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

    // ---------------- PER-MEMBER STORAGE HELPERS (O(1)) ----------------

    fn load_member(env: &Env, addr: &Address) -> Result<MemberData, AjoError> {
        env.storage()
            .instance()
            .get(&DataKey::Member(addr.clone()))
            .ok_or(AjoError::NotFound)
    }

    fn save_member(env: &Env, addr: &Address, data: &MemberData) {
        env.storage()
            .instance()
            .set(&DataKey::Member(addr.clone()), data);
    }

    fn member_exists(env: &Env, addr: &Address) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::Member(addr.clone()))
    }

    fn load_standing(env: &Env, addr: &Address) -> Result<MemberStanding, AjoError> {
        env.storage()
            .instance()
            .get(&DataKey::Standing(addr.clone()))
            .ok_or(AjoError::NotFound)
    }

    fn save_standing(env: &Env, addr: &Address, standing: &MemberStanding) {
        env.storage()
            .instance()
            .set(&DataKey::Standing(addr.clone()), standing);
    }

    /// Append address to the Members list (Vec<Address>).
    fn push_member_list(env: &Env, addr: &Address) {
        let mut list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or_else(|| Vec::new(env));
        list.push_back(addr.clone());
        env.storage().instance().set(&DataKey::Members, &list);
    }

    /// Load the full member address list (only needed for iteration).
    fn load_member_list(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Members)
            .unwrap_or_else(|| Vec::new(env))
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
        env.storage().instance().set(&DataKey::Deployer, &organizer);
        env.storage().instance().set(&DataKey::RoundContribCount, &0_u32);

        let deadline = env.ledger().timestamp() + (frequency_days as u64) * 86_400;
        env.storage().instance().set(&DataKey::RoundDeadline, &deadline);

        // Store organizer as first member using per-member keys
        let organizer_data = MemberData {
            address: organizer.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        };
        Self::save_member(&env, &organizer, &organizer_data);
        Self::save_standing(&env, &organizer, &MemberStanding { missed_count: 0, is_active: true });
        Self::push_member_list(&env, &organizer);

        Ok(())
    }

    // ---------------- MEMBERSHIP ----------------

    pub fn join_circle(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        organizer.require_auth();
        Self::require_not_paused(&env)?;

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }
        if Self::member_exists(&env, &new_member) {
            return Err(AjoError::AlreadyExists);
        }
        if circle.member_count >= circle.max_members {
            return Err(AjoError::CircleAtCapacity);
        }

        Self::save_member(&env, &new_member, &MemberData {
            address: new_member.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        });
        Self::save_standing(&env, &new_member, &MemberStanding { missed_count: 0, is_active: true });
        Self::push_member_list(&env, &new_member);

        circle.member_count = circle.member_count.checked_add(1).ok_or(AjoError::InvalidInput)?;
        env.storage().instance().set(&DataKey::Circle, &circle);

        Ok(())
    }

    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    /// Remove a member before the circle starts, refunding any contributions they have made.
    /// Adjusts `member_count` (totalTarget) accordingly.
    pub fn remove_member(env: Env, organizer: Address, member: Address) -> Result<(), AjoError> {
        organizer.require_auth();
        Self::require_not_paused(&env)?;

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }
        // Organizer cannot remove themselves
        if member == organizer {
            return Err(AjoError::Unauthorized);
        }
        if !Self::member_exists(&env, &member) {
            return Err(AjoError::NotFound);
        }

        let member_data = Self::load_member(&env, &member)?;

        // Refund any pending contributions (total_contributed - total_withdrawn)
        let refund = member_data.total_contributed - member_data.total_withdrawn;
        if refund > 0 {
            // Deduct from pool
            let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
            env.storage()
                .instance()
                .set(&DataKey::TotalPool, &(pool.checked_sub(refund).ok_or(AjoError::ArithmeticOverflow)?));

            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&env.current_contract_address(), &member, &refund);
        }

        // Remove per-member storage entries
        env.storage().instance().remove(&DataKey::Member(member.clone()));
        env.storage().instance().remove(&DataKey::Standing(member.clone()));
        env.storage().instance().remove(&DataKey::LastDeposit(member.clone()));
        env.storage().instance().remove(&DataKey::KycVerified(member.clone()));

        // Remove from the ordered member list
        let old_list = Self::load_member_list(&env);
        let mut new_list: Vec<Address> = Vec::new(&env);
        for addr in old_list.iter() {
            if addr != member {
                new_list.push_back(addr);
            }
        }
        env.storage().instance().set(&DataKey::Members, &new_list);

        // Adjust member_count
        circle.member_count = circle.member_count.saturating_sub(1);
        env.storage().instance().set(&DataKey::Circle, &circle);

        emit_member_removed(&env, &MemberRemovedEvent {
            member: member.clone(),
            refund_amount: refund,
            timestamp: env.ledger().timestamp(),
        });

        Ok(())
    }

    // ---------------- CONTRIBUTIONS ----------------

    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        member.require_auth();
        if Self::is_paused(&env) {
            return Err(AjoError::Paused);
        }
        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let mut circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        // O(1): load only this member's standing
        let mut standing = Self::load_standing(&env, &member)?;
        if standing.missed_count >= 3 || !standing.is_active {
            return Err(AjoError::Disqualified);
        }
        standing.missed_count = 0;
        Self::save_standing(&env, &member, &standing);

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        let round_target = (circle.current_round as i128)
            .checked_mul(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        let had_completed_round = member_data.total_contributed >= round_target;

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        member_data.total_contributed = member_data
            .total_contributed
            .checked_add(amount)
            .ok_or(AjoError::ArithmeticOverflow)?;

        let has_completed_round = member_data.total_contributed >= round_target;
        Self::save_member(&env, &member, &member_data);

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
                env.storage().instance().set(
                    &DataKey::RoundDeadline,
                    &(deadline + (circle.frequency_days as u64) * 86_400),
                );
                if circle.current_round < circle.max_rounds {
                    circle.current_round += 1;
                }
                round_contrib_count = 0;
                env.storage().instance().set(&DataKey::Circle, &circle);
            }
            env.storage().instance().set(&DataKey::RoundContribCount, &round_contrib_count);
        }

        Ok(())
    }

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

        // O(1): load only this member's standing
        let mut standing = Self::load_standing(&env, &member)?;
        if standing.missed_count >= 3 || !standing.is_active {
            return Err(AjoError::Disqualified);
        }
        standing.missed_count = 0;
        Self::save_standing(&env, &member, &standing);

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        member_data.total_contributed += amount;
        Self::save_member(&env, &member, &member_data);

        // O(1): record timestamp under per-member key
        env.storage()
            .instance()
            .set(&DataKey::LastDeposit(member.clone()), &env.ledger().timestamp());

        let mut pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        pool = pool.checked_add(amount).ok_or(AjoError::InvalidInput)?;
        env.storage().instance().set(&DataKey::TotalPool, &pool);

        // Check round completion by iterating the address list
        let member_list = Self::load_member_list(&env);
        let round_contributions = member_list
            .iter()
            .filter(|addr| {
                Self::load_member(&env, &addr)
                    .map(|m| m.total_contributed >= (circle.current_round as i128) * circle.contribution_amount)
                    .unwrap_or(false)
            })
            .count() as u32;

        if round_contributions >= circle.member_count {
            let deadline: u64 = env
                .storage()
                .instance()
                .get(&DataKey::RoundDeadline)
                .unwrap_or(0);
            env.storage().instance().set(
                &DataKey::RoundDeadline,
                &(deadline + (circle.frequency_days as u64) * 86_400),
            );
        }

        // Emit structured deposit event
        emit_deposit(&env, &ContributionEvent {
            member: member.clone(),
            amount,
            round: circle.current_round,
            total_contributed: member_data.total_contributed,
            timestamp: env.ledger().timestamp(),
        });

        Ok(())
    }

    // ---------------- PAYOUT ----------------

    pub fn claim_payout(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        // CHECKS
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

        // O(1): load only this member's standing
        let standing = Self::load_standing(&env, &member)?;
        if !standing.is_active {
            return Err(AjoError::Disqualified);
        }

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        if member_data.has_received_payout {
            return Err(AjoError::AlreadyPaid);
        }

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

        let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        let required = (circle.member_count as i128)
            .checked_mul(circle.contribution_amount)
            .ok_or(AjoError::ArithmeticOverflow)?;
        if pool < required {
            return Err(AjoError::InsufficientFunds);
        }

        let payout = required;

        // EFFECTS — all state before token transfer
        member_data.has_received_payout = true;
        member_data.total_withdrawn = member_data
            .total_withdrawn
            .checked_add(payout)
            .ok_or(AjoError::ArithmeticOverflow)?;
        Self::save_member(&env, &member, &member_data);

        env.storage()
            .instance()
            .set(&DataKey::TotalPool, &(pool.checked_sub(payout).ok_or(AjoError::ArithmeticOverflow)?));

        // INTERACTIONS
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &payout);

        // Emit structured payout event
        emit_payout(&env, &WithdrawalEvent {
            member: member.clone(),
            amount: payout,
            cycle,
            current_round: circle.current_round,
            timestamp: env.ledger().timestamp(),
        });

        Ok(payout)
    }

    pub fn withdraw(env: Env, member: Address, cycle: u32) -> Result<i128, AjoError> {
        Self::claim_payout(env, member, cycle)
    }

    pub fn partial_withdraw(env: Env, member: Address) -> Result<i128, AjoError> {
        Self::require_not_paused(&env)?;
        member.require_auth();

        // Verify caller is an actual circle member
        if !Self::member_exists(&env, &member) {
            return Err(AjoError::Unauthorized);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let net_contributed = member_data.total_contributed - member_data.total_withdrawn;
        let penalty = net_contributed / 10;
        let refund = net_contributed - penalty;

        member_data.total_withdrawn += refund;
        member_data.status = 2; // Exited
        Self::save_member(&env, &member, &member_data);

        let pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPool, &(pool.checked_sub(refund).ok_or(AjoError::ArithmeticOverflow)?));

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (refund, circle.current_round),
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
        env.storage().temporary().set(&DataKey::CycleWithdrawals, &vote);

        // Emit structured dissolution start event
        emit_dissolution_started(&env, &DissolutionEvent {
            initiator: caller.clone(),
            threshold_mode,
            total_members: circle.member_count,
            timestamp: env.ledger().timestamp(),
        });

        Ok(())
    }

    pub fn vote_to_dissolve(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        // O(1): check membership via per-member key
        if !Self::member_exists(&env, &member) {
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

        let mut vote: DissolutionVote = env
            .storage()
            .temporary()
            .get(&DataKey::CycleWithdrawals)
            .ok_or(AjoError::NoActiveVote)?;

        let mut voted_members: Vec<Address> = env
            .storage()
            .temporary()
            .get(&DataKey::VotedMembers)
            .unwrap_or_else(|| Vec::new(&env));

        for i in 0..voted_members.len() {
            if voted_members.get(i).unwrap() == member {
                return Err(AjoError::AlreadyVoted);
            }
        }

        voted_members.push_back(member.clone());
        env.storage().temporary().set(&DataKey::VotedMembers, &voted_members);

        vote.votes_for += 1;

        let threshold_met = if vote.threshold_mode == 0 {
            vote.votes_for * 2 > vote.total_members
        } else {
            vote.votes_for * 100 > vote.total_members * 66
        };

        if threshold_met {
            status = CircleStatus::Dissolved;
            env.storage().instance().set(&DataKey::CircleStatus, &status);
            // Emit structured dissolution passed event
            emit_dissolution_passed(&env, env.ledger().timestamp());
        } else {
            env.storage().temporary().set(&DataKey::CycleWithdrawals, &vote);
        }

        // Also update member status to Exited (2)
        if let Ok(mut member_data) = Self::load_member(&env, &member) {
            member_data.status = 2; // Exited
            Self::save_member(&env, &member, &member_data);
        }

        // Emit structured vote cast event
        emit_vote_cast(&env, &VoteEvent {
            voter: member.clone(),
            votes_for: vote.votes_for,
            total_votes: vote.total_members,
            threshold_mode: vote.threshold_mode,
            timestamp: env.ledger().timestamp(),
        });

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

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        member_data.total_withdrawn += refund;
        Self::save_member(&env, &member, &member_data);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        // Emit structured emergency refund event (dissolution)
        emit_emergency_refund(&env, &EmergencyRefundEvent {
            member: member.clone(),
            amount: refund,
            reason: symbol_short!("dissolve"),
            timestamp: env.ledger().timestamp(),
        });

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

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;

        if member_data.total_contributed <= member_data.total_withdrawn {
            return Err(AjoError::InsufficientFunds);
        }

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        member_data.total_withdrawn += refund;
        Self::save_member(&env, &member, &member_data);

        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        env.events().publish(
            (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
            (refund, circle.current_round),
        );

        Ok(refund)
    }

    // ---------------- ADMIN ----------------

    pub fn panic(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Panicked);
        // Emit structured panic event
        emit_panic(&env, &admin, env.ledger().timestamp());
        Ok(())
    }

    pub fn resume(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Active);
        env.events().publish(
            (symbol_short!("resume"), admin.clone(), env.current_contract_address()),
            env.ledger().timestamp(),
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
        // Emit structured panic event (emergency)
        emit_panic(&env, &caller, env.ledger().timestamp());
        Ok(())
    }

    /// Close the circle: distribute any residual balance to the organizer (admin) and
    /// mark the circle as Dissolved. Cleans up pool state so no funds are stranded.
    pub fn close_circle(env: Env, admin: Address) -> Result<i128, AjoError> {
        Self::require_admin(&env, &admin)?;

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let residual: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);

        // Transfer any residual balance to the organizer/admin
        if residual > 0 {
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&env.current_contract_address(), &circle.organizer, &residual);
        }

        // Zero out the pool and mark circle as Dissolved
        env.storage().instance().set(&DataKey::TotalPool, &0_i128);
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Dissolved);

        emit_circle_closed(&env, &CircleClosedEvent {
            closed_by: admin.clone(),
            residual_distributed: residual,
            timestamp: env.ledger().timestamp(),
        });

        Ok(residual)
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
            // Emit structured role revoked event
            emit_role_revoked(&env, &RoleEvent {
                member: member.clone(),
                role: role.clone(),
                granted_by: caller.clone(),
                timestamp: env.ledger().timestamp(),
            });
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

    /// O(1): reads only the single member's storage entry.
    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError> {
        Self::load_member(&env, &member)
    }

    pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError> {
        env.storage().instance().get(&DataKey::Circle).ok_or(AjoError::NotFound)
    }

    pub fn get_fee_config(env: Env) -> Option<FeeConfig> {
        env.storage().instance().get(&DataKey::FeeConfig)
    }

    pub fn set_fee_config(
        env: Env,
        admin: Address,
        treasury: Address,
        fee_bps: u32,
    ) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        if fee_bps > 1000 {
            return Err(AjoError::InvalidInput);
        }
        // Get previous fee config for event
        let previous_fee: u32 = env.storage().instance().get(&DataKey::FeeConfig)
            .map(|c: FeeConfig| c.fee_bps)
            .unwrap_or(0);

        let config = FeeConfig { treasury: treasury.clone(), fee_bps };
        env.storage().instance().set(&DataKey::FeeConfig, &config);

        // Emit structured fee config event
        emit_fee_config(&env, &FeeConfigEvent {
            treasury: treasury.clone(),
            fee_bps,
            previous_fee_bps: previous_fee,
            timestamp: env.ledger().timestamp(),
        });
        Ok(())
    }

    fn pow10_checked(exp: u32) -> Result<i128, AjoError> {
        Self::checked_pow(10, exp)
    }

    /// Safe integer exponentiation: base^exp with overflow detection.
    fn checked_pow(base: i128, exp: u32) -> Result<i128, AjoError> {
        let mut result: i128 = 1;
        let mut b = base;
        let mut e = exp;
        // binary exponentiation — O(log exp), avoids repeated multiplication drift
        while e > 0 {
            if e & 1 == 1 {
                result = result.checked_mul(b).ok_or(AjoError::ArithmeticOverflow)?;
            }
            e >>= 1;
            if e > 0 {
                b = b.checked_mul(b).ok_or(AjoError::ArithmeticOverflow)?;
            }
        }
        Ok(result)
    }

    /// Compound interest: A = P * (1 + r/12)^months  (monthly compounding).
    ///
    /// `annual_rate_bps` — annual rate in basis points (e.g. 500 = 5.00 %).
    /// `months`          — number of months (up to 24 supported without overflow).
    ///
    /// Uses a fixed-point scale of SCALE = 10^12 to preserve precision.
    /// Returns the *accrued interest* (A - P), not the total amount.
    pub fn calculate_yield(principal: i128, annual_rate_bps: u32, months: u32) -> Result<i128, AjoError> {
        if principal <= 0 || months == 0 {
            return Err(AjoError::InvalidInput);
        }
        if annual_rate_bps > 100_000 {
            // cap at 1000 % annual to prevent overflow
            return Err(AjoError::InvalidInput);
        }

        // SCALE = 1_000_000_000_000 (10^12)
        const SCALE: i128 = 1_000_000_000_000;

        // monthly_factor = SCALE + (annual_rate_bps * SCALE) / (12 * 10_000)
        //                = SCALE * (1 + r/12)  in fixed-point
        let numerator = (annual_rate_bps as i128)
            .checked_mul(SCALE)
            .ok_or(AjoError::ArithmeticOverflow)?;
        let monthly_add = numerator / (12 * 10_000);
        let monthly_factor = SCALE
            .checked_add(monthly_add)
            .ok_or(AjoError::ArithmeticOverflow)?;

        // Compute monthly_factor^months using binary exponentiation in SCALE space.
        // After each squaring we divide by SCALE to keep the value in range.
        let mut result: i128 = SCALE; // represents 1.0
        let mut b = monthly_factor;
        let mut e = months;
        while e > 0 {
            if e & 1 == 1 {
                result = result
                    .checked_mul(b)
                    .ok_or(AjoError::ArithmeticOverflow)?
                    / SCALE;
            }
            e >>= 1;
            if e > 0 {
                b = b.checked_mul(b).ok_or(AjoError::ArithmeticOverflow)? / SCALE;
            }
        }
        // result is now (1 + r/12)^months in SCALE units
        // total = principal * result / SCALE
        let total = principal
            .checked_mul(result)
            .ok_or(AjoError::ArithmeticOverflow)?
            / SCALE;

        let interest = total.checked_sub(principal).ok_or(AjoError::ArithmeticOverflow)?;
        Ok(interest)
    }

    pub fn get_total_pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0)
    }

    /// O(1): reads only this member's timestamp entry.
    pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError> {
        env.storage()
            .instance()
            .get(&DataKey::LastDeposit(member))
            .ok_or(AjoError::NotFound)
    }

    // ---------------- SHUFFLE ----------------

    pub fn shuffle_rotation(env: Env, organizer: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

        Self::require_not_paused(&env)?;

        // Load address list for iteration (only when needed)
        let member_list = Self::load_member_list(&env);
        if member_list.is_empty() {
            return Err(AjoError::NotFound);
        }

        let mut rotation: Vec<Address> = Vec::new(&env);
        for addr in member_list.iter() {
            rotation.push_back(addr);
        }

        let n = rotation.len();
        if n < 2 {
            env.storage().instance().set(&DataKey::RotationOrder, &rotation);
            return Ok(());
        }

        let ledger_seq = env.ledger().sequence();
        let tx_hash: BytesN<32> = env.crypto().sha256(
            &soroban_sdk::Bytes::from_slice(&env, &ledger_seq.to_be_bytes())
        ).into();
        let hash_bytes = tx_hash.to_array();

        for i in (1..n).rev() {
            let byte_idx = (i as usize) % 32;
            let j = (hash_bytes[byte_idx] as u32) % (i + 1);
            let a = rotation.get(i).unwrap();
            let b = rotation.get(j).unwrap();
            rotation.set(i, b);
            rotation.set(j, a);
        }

        env.storage().instance().set(&DataKey::RotationOrder, &rotation);

        Ok(())
    }

    // ---------------- MEMBER MANAGEMENT ----------------

    pub fn slash_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        // O(1): load only this member's standing
        let mut standing = Self::load_standing(&env, &member)?;
        standing.missed_count += 1;
        if standing.missed_count >= 3 {
            standing.is_active = false;
        }
        Self::save_standing(&env, &member, &standing);

        Ok(())
    }

    pub fn set_kyc_status(
        env: Env,
        admin: Address,
        member: Address,
        is_verified: bool,
    ) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        // O(1): check membership via per-member key
        if !Self::member_exists(&env, &member) {
            return Err(AjoError::NotFound);
        }

        env.storage()
            .instance()
            .set(&DataKey::KycVerified(member), &is_verified);

        Ok(())
    }

    pub fn boot_dormant_member(
        env: Env,
        admin: Address,
        member: Address,
    ) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        // O(1): load only this member's standing
        let mut standing = Self::load_standing(&env, &member)?;
        if standing.is_active && standing.missed_count < 3 {
            return Err(AjoError::InvalidInput);
        }
        standing.is_active = false;
        Self::save_standing(&env, &member, &standing);

        // O(1): load only this member's data
        let mut member_data = Self::load_member(&env, &member)?;
        member_data.status = 2;
        Self::save_member(&env, &member, &member_data);

        Ok(())
    }

    pub fn propose_upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) -> Result<u64, AjoError> {
        Self::require_admin(&env, &admin)?;
        let unlock_time = env.ledger().timestamp() + UPGRADE_TIMELOCK_SECONDS;
        let proposal = TimelockProposal { new_wasm_hash, unlock_time };
        env.storage().instance().set(&DataKey::PendingUpgrade, &proposal);
        env.events().publish(
            (symbol_short!("upg_prop"), admin),
            (unlock_time,),
        );
        Ok(unlock_time)
    }

    pub fn execute_upgrade(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        let proposal: TimelockProposal = env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
            .ok_or(AjoError::NotFound)?;
        if env.ledger().timestamp() < proposal.unlock_time {
            return Err(AjoError::TimelockNotReady);
        }
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.deployer().update_current_contract_wasm(proposal.new_wasm_hash);
        Ok(())
    }
}

#[cfg(test)]
mod inline_tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Address, Env, Map};

    fn setup_circle_with_member(env: &Env) -> (AjoCircleClient<'_>, Address, Address, Address) {
        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let organizer = Address::generate(env);
        let member = Address::generate(env);
        let token_address = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address);
        token_admin.mint(&organizer, &10_000_i128);
        token_admin.mint(&member, &10_000_i128);
        client.initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &3_u32, &3_u32);
        client.add_member(&organizer, &member);
        (client, organizer, member, token_address)
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
