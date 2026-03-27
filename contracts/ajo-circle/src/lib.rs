#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, Map, Vec};

const MAX_MEMBERS: u32 = 50;
const HARD_CAP: u32 = 100;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
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
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleData {
    pub organizer: Address,
    pub token_address: Address, // New field for USDC/XLM contract address
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
    pub status: u32, // 0 = Active, 1 = Inactive, 2 = Exited
}

/// Circle lifecycle status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CircleStatus {
    Active,
    VotingForDissolution,
    Dissolved,
    Panicked,
}

/// Tracks an in-progress dissolution vote
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionVote {
    pub votes_for: u32,
    pub total_members: u32,
    /// Threshold mode: 0 = simple majority (>50%), 1 = supermajority (>66%)
    pub threshold_mode: u32,
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
    CircleStatus,
    DissolutionVote,
    /// Tracks which members have already voted (stored as Map<Address, bool>)
    VoteCast,
    /// Shuffled payout rotation order
    RotationOrder,
    /// Round deadline timestamp
    RoundDeadline,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    /// Initialize a new Ajo circle
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

        let joined_member_count = circle
            .member_count
            .checked_sub(1)
            .ok_or(AjoError::InvalidInput)?;

        if joined_member_count >= circle.max_members {
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
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    /// Record a contribution from a member
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        member.require_auth();

        // Block contributions during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let circle: CircleData = env
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
            // Transfer tokens from member to contract
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&member, &env.current_contract_address(), &amount);

            member_data.total_contributed += amount;
            members.set(member.clone(), member_data);
        } else {
            return Err(AjoError::NotFound);
        }

        // Count contributions this round (total_contributed tracks cumulative; use round * amount as threshold)
        let round_contributions = members.iter()
            .filter(|(_, m)| m.total_contributed >= (circle.current_round as i128) * circle.contribution_amount)
            .count() as u32;

        env.storage().instance().set(&DataKey::Members, &members);

        // If all members have contributed this round, advance the deadline
        if round_contributions >= circle.member_count {
            let deadline: u64 = env.storage().instance().get(&DataKey::RoundDeadline).unwrap_or(0);
            let next_deadline = deadline + (circle.frequency_days as u64) * 86_400;
            env.storage().instance().set(&DataKey::RoundDeadline, &next_deadline);
        }

        Ok(())
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
    pub fn slash_member(env: Env, organizer: Address, member: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        let circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

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

    /// Claim payout when it's a member's turn
    pub fn claim_payout(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        // Block payouts during panic
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let standings: Map<Address, MemberStanding> = env.storage()
            .instance()
            .get(&DataKey::Standings)
            .unwrap_or(Map::new(&env));

        if let Some(standing) = standings.get(member.clone()) {
            if !standing.is_active {
                return Err(AjoError::Disqualified);
            }
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        // Enforce rotation order if a shuffle has been committed
        if let Some(rotation) = env.storage()
            .instance()
            .get::<DataKey, Vec<Address>>(&DataKey::RotationOrder)
        {
            // Current round is 1-based; index into rotation is (current_round - 1)
            let idx = (circle.current_round - 1) as u32;
            let expected = rotation.get(idx).ok_or(AjoError::InvalidInput)?;
            if expected != member {
                return Err(AjoError::Unauthorized);
            }
        }

        if let Some(mut member_data) = members.get(member.clone()) {
            if member_data.has_received_payout {
                return Err(AjoError::AlreadyPaid);
            }

            let payout = (circle.member_count as i128) * circle.contribution_amount;

            // Transfer payout from contract to member
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&env.current_contract_address(), &member, &payout);

            member_data.has_received_payout = true;
            member_data.total_withdrawn += payout;

            members.set(member, member_data);
            env.storage().instance().set(&DataKey::Members, &members);

            Ok(payout)
        } else {
            Err(AjoError::NotFound)
        }
    }

    /// Perform a partial withdrawal with penalty
    pub fn partial_withdraw(env: Env, member: Address, amount: i128) -> Result<i128, AjoError> {
        member.require_auth();

        // Block partial withdrawals during panic — use emergency_refund instead
        if Self::get_circle_status(env.clone()) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            let available = member_data.total_contributed - member_data.total_withdrawn;

            if amount > available {
                return Err(AjoError::InsufficientFunds);
            }

            let net_amount = amount - (amount * 10) / 100;

            let circle: CircleData = env
                .storage()
                .instance()
                .get(&DataKey::Circle)
                .ok_or(AjoError::NotFound)?;

            // Transfer net_amount from contract to member
            let token_client = token::Client::new(&env, &circle.token_address);
            token_client.transfer(&env.current_contract_address(), &member, &net_amount);

            member_data.total_withdrawn += amount;

            members.set(member, member_data);
            env.storage().instance().set(&DataKey::Members, &members);

            Ok(net_amount)
        } else {
            Err(AjoError::NotFound)
        }
    }

    /// Get circle state
    pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError> {
        env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)
    }

    /// Get member balance and status
    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError> {
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        members.get(member).ok_or(AjoError::NotFound)
    }

    /// Get all members
    pub fn get_members(env: Env) -> Result<Vec<MemberData>, AjoError> {
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut members_vec = Vec::new(&env);
        for (_, member) in members.iter() {
            members_vec.push_back(member);
        }

        Ok(members_vec)
    }

    // ─── Dissolution Voting ───────────────────────────────────────────────────

    /// Start a dissolution vote. Any active member or the organizer may call this.
    /// `threshold_mode`: 0 = simple majority (>50%), 1 = supermajority (>66%).
    pub fn start_dissolution_vote(
        env: Env,
        caller: Address,
        threshold_mode: u32,
    ) -> Result<(), AjoError> {
        caller.require_auth();

        if threshold_mode > 1 {
            return Err(AjoError::InvalidInput);
        }

        // Circle must exist and be active
        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active);

        match status {
            CircleStatus::Dissolved => return Err(AjoError::CircleAlreadyDissolved),
            CircleStatus::VotingForDissolution => return Err(AjoError::VoteAlreadyActive),
            CircleStatus::Panicked => return Err(AjoError::CirclePanicked),
            CircleStatus::Active => {}
        }

        // Caller must be a member or the organizer
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if !members.contains_key(caller.clone()) && circle.organizer != caller {
            return Err(AjoError::Unauthorized);
        }

        let vote = DissolutionVote {
            votes_for: 0,
            total_members: circle.member_count,
            threshold_mode,
        };

        env.storage()
            .instance()
            .set(&DataKey::CircleStatus, &CircleStatus::VotingForDissolution);
        env.storage()
            .instance()
            .set(&DataKey::DissolutionVote, &vote);
        env.storage()
            .instance()
            .set(&DataKey::VoteCast, &Map::<Address, bool>::new(&env));

        Ok(())
    }

    /// Cast a YES vote for dissolution. Each member may vote once.
    /// If the threshold is reached the circle status flips to Dissolved automatically.
    pub fn vote_to_dissolve(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active);

        if status != CircleStatus::VotingForDissolution {
            return Err(AjoError::NoActiveVote);
        }

        // Caller must be a registered member
        let members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if !members.contains_key(member.clone()) {
            return Err(AjoError::Unauthorized);
        }

        // Prevent double-voting
        let mut vote_cast: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::VoteCast)
            .unwrap_or_else(|| Map::new(&env));

        if vote_cast.get(member.clone()).unwrap_or(false) {
            return Err(AjoError::AlreadyVoted);
        }

        vote_cast.set(member.clone(), true);
        env.storage().instance().set(&DataKey::VoteCast, &vote_cast);

        let mut vote: DissolutionVote = env
            .storage()
            .instance()
            .get(&DataKey::DissolutionVote)
            .ok_or(AjoError::NoActiveVote)?;

        vote.votes_for += 1;

        // Check threshold
        let threshold_met = if vote.threshold_mode == 1 {
            // Supermajority: strictly more than 66%
            vote.votes_for * 100 > vote.total_members * 66
        } else {
            // Simple majority: strictly more than 50%
            vote.votes_for * 2 > vote.total_members
        };

        if threshold_met {
            env.storage()
                .instance()
                .set(&DataKey::CircleStatus, &CircleStatus::Dissolved);
        }

        env.storage()
            .instance()
            .set(&DataKey::DissolutionVote, &vote);

        Ok(())
    }

    /// Distribute funds back to members proportional to their contributions.
    /// Can only be called after the circle has been dissolved via voting.
    /// Returns the refund amount for the calling member.
    pub fn dissolve_and_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        let status: CircleStatus = env
            .storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active);

        if status != CircleStatus::Dissolved {
            return Err(AjoError::CircleNotActive);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        // Refund = what they put in minus what they already took out
        let refund = member_data.total_contributed - member_data.total_withdrawn;

        if refund <= 0 {
            return Err(AjoError::InsufficientFunds);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        // Transfer refund from contract to member
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        member_data.total_withdrawn += refund;
        member_data.status = 2; // Exited
        members.set(member, member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(refund)
    }

    /// Get the current circle status
    pub fn get_circle_status(env: Env) -> CircleStatus {
        env.storage()
            .instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active)
    }

    /// Get the current dissolution vote state (if any)
    pub fn get_dissolution_vote(env: Env) -> Result<DissolutionVote, AjoError> {
        env.storage()
            .instance()
            .get(&DataKey::DissolutionVote)
            .ok_or(AjoError::NoActiveVote)
    }

    // ─── Emergency "Panic Button" ─────────────────────────────────────────────

    /// Admin-triggered emergency halt. Only the organizer can call this.
    /// Sets the circle status to `Panicked`, which blocks all normal operations
    /// and enables `emergency_refund()` for every member.
    pub fn panic(env: Env, organizer: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

        let status = Self::get_circle_status(env.clone());
        if status == CircleStatus::Dissolved {
            return Err(AjoError::CircleAlreadyDissolved);
        }
        if status == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }

        env.storage()
            .instance()
            .set(&DataKey::CircleStatus, &CircleStatus::Panicked);

        Ok(())
    }

    /// Emergency refund available to any member when the circle is in `Panicked` state.
    /// Returns (total_contributed − total_withdrawn) to the caller with no penalty.
    pub fn emergency_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();

        let status = Self::get_circle_status(env.clone());
        if status != CircleStatus::Panicked {
            return Err(AjoError::CircleNotActive);
        }

        let mut members: Map<Address, MemberData> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        if refund <= 0 {
            return Err(AjoError::InsufficientFunds);
        }

        let circle: CircleData = env
            .storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        // Transfer refund from contract to member
        let token_client = token::Client::new(&env, &circle.token_address);
        token_client.transfer(&env.current_contract_address(), &member, &refund);

        member_data.total_withdrawn += refund;
        member_data.status = 2; // Exited
        members.set(member, member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(refund)
    }

    /// Returns `true` when the circle is in emergency-halt state.
    pub fn is_panicked(env: Env) -> bool {
        Self::get_circle_status(env) == CircleStatus::Panicked
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, token};

    // ── Helper ────────────────────────────────────────────────────────────────

    /// Spin up a circle with the organizer + one extra member, each having
    /// contributed `contribution` tokens.
    fn setup_circle_with_member(
        env: &Env,
    ) -> (AjoCircleClient<'_>, Address, Address, Address) {
        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(env, &contract_id);

        let organizer = Address::generate(env);
        let member = Address::generate(env);
        let admin = Address::generate(env);
        let token_address = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address);
        let token_client = token::Client::new(env, &token_address);

        // Mint tokens to participants
        token_admin.mint(&organizer, &1000_i128);
        token_admin.mint(&member, &1000_i128);

        client
            .initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &12_u32, &5_u32);
        client.add_member(&organizer, &member);
        
        // Approve contract to spend tokens
        client.contribute(&organizer, &200_i128);
        client.contribute(&member, &200_i128);

        (client, organizer, member, token_address)
    }

    // ── Existing tests ────────────────────────────────────────────────────────

    #[test]
    fn enforce_member_limit_at_contract_level() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(&env, &contract_id);

        let organizer = Address::generate(&env);
        let member_one = Address::generate(&env);
        let member_two = Address::generate(&env);
        let member_three = Address::generate(&env);
        let token_address = Address::generate(&env);

        let init = client.initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &12_u32, &2_u32);
        assert_eq!(init, Ok(()));

        let first_join = client.add_member(&organizer, &member_one);
        assert_eq!(first_join, Ok(()));

        let second_join = client.add_member(&organizer, &member_two);
        assert_eq!(second_join, Ok(()));

        let third_join = client.add_member(&organizer, &member_three);
        assert_eq!(third_join, Err(AjoError::CircleAtCapacity));
    }

    // ── Panic-button tests ────────────────────────────────────────────────────

    #[test]
    fn test_panic_happy_path() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _member, _token) = setup_circle_with_member(&env);

        // Before panic, is_panicked returns false
        assert!(!client.is_panicked());

        // Organizer triggers panic
        let result = client.panic(&organizer);
        assert_eq!(result, Ok(()));

        // Status is now Panicked
        assert!(client.is_panicked());
        assert_eq!(client.get_circle_status(), CircleStatus::Panicked);
    }

    #[test]
    fn test_panic_only_organizer() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _organizer, member, _token) = setup_circle_with_member(&env);

        // A regular member cannot trigger panic
        let result = client.panic(&member);
        assert_eq!(result, Err(AjoError::Unauthorized));
        assert!(!client.is_panicked());
    }

    #[test]
    fn test_emergency_refund_during_panic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member, token_address) = setup_circle_with_member(&env);
        let token_client = token::Client::new(&env, &token_address);

        // Initial balances after setup_circle_with_member: 
        // Minted 1000, contributed 200. Balance should be 800.
        assert_eq!(token_client.balance(&member), 800_i128);

        // Trigger panic
        client.panic(&organizer);

        // Member claims emergency refund
        let refund = client.emergency_refund(&member);
        assert_eq!(refund, Ok(200_i128));
        
        // Balance should now be 1000
        assert_eq!(token_client.balance(&member), 1000_i128);

        // Organizer claims emergency refund
        let org_refund = client.emergency_refund(&organizer);
        assert_eq!(org_refund, Ok(200_i128));
        assert_eq!(token_client.balance(&organizer), 1000_i128);

        // Second refund attempt fails (already withdrawn)
        let double = client.emergency_refund(&member);
        assert_eq!(double, Err(AjoError::InsufficientFunds));
    }

    #[test]
    fn test_emergency_refund_without_panic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _organizer, member, _token) = setup_circle_with_member(&env);

        // Refund should fail when circle is not panicked
        let result = client.emergency_refund(&member);
        assert_eq!(result, Err(AjoError::CircleNotActive));
    }

    #[test]
    fn test_panic_blocks_contribute() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member, _token) = setup_circle_with_member(&env);

        client.panic(&organizer);

        let result = client.contribute(&member, &50_i128);
        assert_eq!(result, Err(AjoError::CirclePanicked));
    }

    #[test]
    fn test_panic_blocks_join() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _member, _token) = setup_circle_with_member(&env);

        client.panic(&organizer);

        let new_member = Address::generate(&env);
        let result = client.add_member(&organizer, &new_member);
        assert_eq!(result, Err(AjoError::CirclePanicked));
    }
}

#[cfg(test)]
mod test;
