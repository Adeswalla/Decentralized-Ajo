#![no_std]

pub mod factory;

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env, Map, Vec};

const MAX_MEMBERS: u32 = 50;
const HARD_CAP: u32 = 100;

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
    pub status: u32, // 0 = Active, 1 = Inactive, 2 = Exited
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
    /// 0 = simple majority (>50%), 1 = supermajority (>66%)
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
    Admin,
    KycStatus,
    CircleStatus,
    DissolutionVote,
    VoteCast,
    RotationOrder,
    RoundDeadline,
    RoundContribCount,
    EthUsdPrice,
    EthUsdDecimals,
    LastDepositAt,
    TotalPool,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    // ─── Private helpers ──────────────────────────────────────────────────────

    fn require_admin(env: &Env, admin: &Address) -> Result<(), AjoError> {
        admin.require_auth();
        let stored: Address = env
            .storage().instance().get(&DataKey::Admin)
            .ok_or(AjoError::NotFound)?;
        if stored != *admin { return Err(AjoError::Unauthorized); }
        Ok(())
    }

    /// Read circle status without cloning Env.
    fn circle_status(env: &Env) -> CircleStatus {
        env.storage().instance()
            .get(&DataKey::CircleStatus)
            .unwrap_or(CircleStatus::Active)
    }

    /// Return Err(CirclePanicked) when the circle is in panic state.
    fn require_not_panicked(env: &Env) -> Result<(), AjoError> {
        if Self::circle_status(env) == CircleStatus::Panicked {
            return Err(AjoError::CirclePanicked);
        }
        Ok(())
    }

    /// Transfer `amount` tokens from `from` to `to` using the circle token.
    fn token_transfer(env: &Env, token_address: &Address, from: &Address, to: &Address, amount: i128) {
        token::Client::new(env, token_address).transfer(from, to, &amount);
    }

    /// Validate and reset a member's standing. Returns Err if disqualified.
    fn check_and_reset_standing(
        standings: &mut Map<Address, MemberStanding>,
        member: &Address,
    ) -> Result<(), AjoError> {
        if let Some(mut standing) = standings.get(member.clone()) {
            if standing.missed_count >= 3 || !standing.is_active {
                return Err(AjoError::Disqualified);
            }
            standing.missed_count = 0;
            standings.set(member.clone(), standing);
            Ok(())
        } else {
            Err(AjoError::NotFound)
        }
    }

    /// Load members map or return NotFound.
    fn load_members(env: &Env) -> Result<Map<Address, MemberData>, AjoError> {
        env.storage().instance().get(&DataKey::Members).ok_or(AjoError::NotFound)
    }

    /// Load circle data or return NotFound.
    fn load_circle(env: &Env) -> Result<CircleData, AjoError> {
        env.storage().instance().get(&DataKey::Circle).ok_or(AjoError::NotFound)
    }

    /// Load standings map, defaulting to empty.
    fn load_standings(env: &Env) -> Map<Address, MemberStanding> {
        env.storage().instance().get(&DataKey::Standings).unwrap_or_else(|| Map::new(env))
    }

    /// Shared refund logic used by both dissolve_and_refund and emergency_refund.
    fn do_refund(env: &Env, member: &Address) -> Result<i128, AjoError> {
        let mut members = Self::load_members(env)?;
        let mut member_data = members.get(member.clone()).ok_or(AjoError::NotFound)?;

        let refund = member_data.total_contributed - member_data.total_withdrawn;
        if refund <= 0 { return Err(AjoError::InsufficientFunds); }

        let circle = Self::load_circle(env)?;
        Self::token_transfer(env, &circle.token_address, &env.current_contract_address(), member, refund);

        member_data.total_withdrawn += refund;
        member_data.status = 2;
        members.set(member.clone(), member_data);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(refund)
    }

    fn pow10_checked(exp: u32) -> Result<i128, AjoError> {
        let mut result: i128 = 1;
        let mut i: u32 = 0;
        while i < exp {
            result = result.checked_mul(10).ok_or(AjoError::ArithmeticOverflow)?;
            i += 1;
        }
        Ok(result)
    }

    // ─── Public interface ─────────────────────────────────────────────────────

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

        let configured_max = if max_members == 0 { MAX_MEMBERS } else { max_members };

        if contribution_amount <= 0
            || frequency_days == 0
            || max_rounds == 0
            || configured_max == 0
            || configured_max > HARD_CAP
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
            max_members: configured_max,
        };

        env.storage().instance().set(&DataKey::Circle, &circle_data);
        env.storage().instance().set(&DataKey::Admin, &organizer);
        env.storage().instance().set(&DataKey::RoundContribCount, &0_u32);

        let deadline = env.ledger().timestamp() + (frequency_days as u64) * 86_400;
        env.storage().instance().set(&DataKey::RoundDeadline, &deadline);

        let mut members: Map<Address, MemberData> = Map::new(&env);
        members.set(organizer.clone(), MemberData {
            address: organizer.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        });
        env.storage().instance().set(&DataKey::Members, &members);

        let mut standings: Map<Address, MemberStanding> = Map::new(&env);
        standings.set(organizer.clone(), MemberStanding { missed_count: 0, is_active: true });
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    pub fn join_circle(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        organizer.require_auth();
        Self::require_not_panicked(&env)?;

        let mut circle = Self::load_circle(&env)?;
        if circle.organizer != organizer { return Err(AjoError::Unauthorized); }

        let mut members = Self::load_members(&env)?;
        if members.contains_key(new_member.clone()) { return Err(AjoError::AlreadyExists); }
        if circle.member_count >= circle.max_members { return Err(AjoError::CircleAtCapacity); }

        members.set(new_member.clone(), MemberData {
            address: new_member.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        });
        circle.member_count = circle.member_count.checked_add(1).ok_or(AjoError::InvalidInput)?;

        let mut standings = Self::load_standings(&env);
        standings.set(new_member.clone(), MemberStanding { missed_count: 0, is_active: true });

        env.storage().instance().set(&DataKey::Members, &members);
        env.storage().instance().set(&DataKey::Circle, &circle);
        env.storage().instance().set(&DataKey::Standings, &standings);

        Ok(())
    }

    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        Self::join_circle(env, organizer, new_member)
    }

    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        member.require_auth();
        Self::require_not_panicked(&env)?;

        if amount <= 0 { return Err(AjoError::InvalidInput); }

        let mut circle = Self::load_circle(&env)?;
        let mut standings = Self::load_standings(&env);
        Self::check_and_reset_standing(&mut standings, &member)?;
        env.storage().instance().set(&DataKey::Standings, &standings);

        let mut members = Self::load_members(&env)?;
        if let Some(mut member_data) = members.get(member.clone()) {
            let round_target = (circle.current_round as i128)
                .checked_mul(circle.contribution_amount)
                .ok_or(AjoError::ArithmeticOverflow)?;
            let had_completed = member_data.total_contributed >= round_target;

            Self::token_transfer(&env, &circle.token_address, &member, &env.current_contract_address(), amount);

            member_data.total_contributed = member_data.total_contributed
                .checked_add(amount).ok_or(AjoError::ArithmeticOverflow)?;

            let now_completed = member_data.total_contributed >= round_target;
            members.set(member.clone(), member_data);

            if !had_completed && now_completed {
                let mut count: u32 = env.storage().instance()
                    .get(&DataKey::RoundContribCount).unwrap_or(0_u32);
                count = count.checked_add(1).ok_or(AjoError::ArithmeticOverflow)?;

                if count >= circle.member_count {
                    let deadline: u64 = env.storage().instance()
                        .get(&DataKey::RoundDeadline).unwrap_or(0);
                    env.storage().instance().set(
                        &DataKey::RoundDeadline,
                        &(deadline + (circle.frequency_days as u64) * 86_400),
                    );
                    if circle.current_round < circle.max_rounds {
                        circle.current_round += 1;
                    }
                    count = 0;
                    env.storage().instance().set(&DataKey::Circle, &circle);
                }
                env.storage().instance().set(&DataKey::RoundContribCount, &count);
            }
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Members, &members);
        Ok(())
    }

    /// Deposit exactly the configured periodic contribution amount.
    /// Records the ledger timestamp and increments the tracked pool balance.
    pub fn deposit(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();
        Self::require_not_panicked(&env)?;

        let circle = Self::load_circle(&env)?;
        let amount = circle.contribution_amount;
        if amount <= 0 { return Err(AjoError::InvalidInput); }

        let mut standings = Self::load_standings(&env);
        Self::check_and_reset_standing(&mut standings, &member)?;
        env.storage().instance().set(&DataKey::Standings, &standings);

        let mut members = Self::load_members(&env)?;
        if let Some(mut member_data) = members.get(member.clone()) {
            Self::token_transfer(&env, &circle.token_address, &member, &env.current_contract_address(), amount);
            member_data.total_contributed += amount;
            members.set(member.clone(), member_data);
        } else {
            return Err(AjoError::NotFound);
        }
        env.storage().instance().set(&DataKey::Members, &members);

        let ts = env.ledger().timestamp();
        let mut last_deposits: Map<Address, u64> = env.storage().instance()
            .get(&DataKey::LastDepositAt).unwrap_or_else(|| Map::new(&env));
        last_deposits.set(member.clone(), ts);
        env.storage().instance().set(&DataKey::LastDepositAt, &last_deposits);

        let mut pool: i128 = env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0);
        pool = pool.checked_add(amount).ok_or(AjoError::InvalidInput)?;
        env.storage().instance().set(&DataKey::TotalPool, &pool);

        Ok(())
    }

    pub fn get_total_pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPool).unwrap_or(0)
    }

    pub fn get_last_deposit_timestamp(env: Env, member: Address) -> Result<u64, AjoError> {
        let m: Map<Address, u64> = env.storage().instance()
            .get(&DataKey::LastDepositAt).ok_or(AjoError::NotFound)?;
        m.get(member).ok_or(AjoError::NotFound)
    }

    pub fn shuffle_rotation(env: Env, organizer: Address) -> Result<(), AjoError> {
        organizer.require_auth();
        Self::require_not_panicked(&env)?;

        let circle = Self::load_circle(&env)?;
        if circle.organizer != organizer { return Err(AjoError::Unauthorized); }

        let members = Self::load_members(&env)?;
        let mut rotation: Vec<Address> = Vec::new(&env);
        for (addr, _) in members.iter() { rotation.push_back(addr); }

        let n = rotation.len();
        if n >= 2 {
            let ledger_seq = env.ledger().sequence();
            let tx_hash: BytesN<32> = env.crypto().sha256(
                &soroban_sdk::Bytes::from_slice(&env, &ledger_seq.to_be_bytes())
            ).into();
            let hash_bytes = tx_hash.to_array();

            for i in (1..n).rev() {
                let j = (hash_bytes[(i as usize) % 32] as u32) % (i + 1);
                let a = rotation.get(i).unwrap();
                let b = rotation.get(j).unwrap();
                rotation.set(i, b);
                rotation.set(j, a);
            }
        }

        env.storage().instance().set(&DataKey::RotationOrder, &rotation);
        Ok(())
    }

    pub fn slash_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        let mut standings = Self::load_standings(&env);
        if let Some(mut standing) = standings.get(member.clone()) {
            standing.missed_count += 1;
            if standing.missed_count >= 3 { standing.is_active = false; }
            standings.set(member.clone(), standing);
            env.storage().instance().set(&DataKey::Standings, &standings);
            Ok(())
        } else {
            Err(AjoError::NotFound)
        }
    }

    pub fn set_kyc_status(env: Env, admin: Address, member: Address, is_verified: bool) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        let mut kyc: Map<Address, bool> = env.storage().instance()
            .get(&DataKey::KycStatus).unwrap_or_else(|| Map::new(&env));
        kyc.set(member, is_verified);
        env.storage().instance().set(&DataKey::KycStatus, &kyc);
        Ok(())
    }

    pub fn boot_dormant_member(env: Env, admin: Address, member: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;

        let mut standings = Self::load_standings(&env);
        if let Some(mut s) = standings.get(member.clone()) {
            s.is_active = false;
            standings.set(member.clone(), s);
        } else {
            return Err(AjoError::NotFound);
        }

        let mut members = Self::load_members(&env)?;
        if let Some(mut md) = members.get(member.clone()) {
            md.status = 2;
            members.set(member, md);
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Standings, &standings);
        env.storage().instance().set(&DataKey::Members, &members);
        Ok(())
    }

    pub fn claim_payout(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();
        Self::require_not_panicked(&env)?;

        let circle = Self::load_circle(&env)?;
        let standings = Self::load_standings(&env);
        if let Some(s) = standings.get(member.clone()) {
            if !s.is_active { return Err(AjoError::Disqualified); }
        }

        let mut members = Self::load_members(&env)?;

        if let Some(rotation) = env.storage().instance()
            .get::<DataKey, Vec<Address>>(&DataKey::RotationOrder)
        {
            let expected = rotation.get(circle.current_round - 1).ok_or(AjoError::InvalidInput)?;
            if expected != member { return Err(AjoError::Unauthorized); }
        }

        if let Some(mut md) = members.get(member.clone()) {
            if md.has_received_payout { return Err(AjoError::AlreadyPaid); }

            let payout = (circle.member_count as i128) * circle.contribution_amount;
            Self::token_transfer(&env, &circle.token_address, &env.current_contract_address(), &member, payout);

            md.has_received_payout = true;
            md.total_withdrawn += payout;
            members.set(member, md);
            env.storage().instance().set(&DataKey::Members, &members);
            Ok(payout)
        } else {
            Err(AjoError::NotFound)
        }
    }

    pub fn partial_withdraw(env: Env, member: Address, amount: i128) -> Result<i128, AjoError> {
        member.require_auth();
        Self::require_not_panicked(&env)?;

        if amount <= 0 { return Err(AjoError::InvalidInput); }

        let mut members = Self::load_members(&env)?;
        if let Some(mut md) = members.get(member.clone()) {
            let available = md.total_contributed - md.total_withdrawn;
            if amount > available { return Err(AjoError::InsufficientFunds); }

            let net = amount - (amount * 10) / 100;
            let circle = Self::load_circle(&env)?;
            Self::token_transfer(&env, &circle.token_address, &env.current_contract_address(), &member, net);

            md.total_withdrawn += amount;
            members.set(member, md);
            env.storage().instance().set(&DataKey::Members, &members);
            Ok(net)
        } else {
            Err(AjoError::NotFound)
        }
    }

    pub fn get_circle_state(env: Env) -> Result<CircleData, AjoError> {
        Self::load_circle(&env)
    }

    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, AjoError> {
        Self::load_members(&env)?.get(member).ok_or(AjoError::NotFound)
    }

    pub fn get_members(env: Env) -> Result<Vec<MemberData>, AjoError> {
        let members = Self::load_members(&env)?;
        let mut out = Vec::new(&env);
        for (_, m) in members.iter() { out.push_back(m); }
        Ok(out)
    }

    // ─── Dissolution voting ───────────────────────────────────────────────────

    pub fn start_dissolution_vote(env: Env, caller: Address, threshold_mode: u32) -> Result<(), AjoError> {
        caller.require_auth();
        if threshold_mode > 1 { return Err(AjoError::InvalidInput); }

        let circle = Self::load_circle(&env)?;
        match Self::circle_status(&env) {
            CircleStatus::Dissolved => return Err(AjoError::CircleAlreadyDissolved),
            CircleStatus::VotingForDissolution => return Err(AjoError::VoteAlreadyActive),
            CircleStatus::Panicked => return Err(AjoError::CirclePanicked),
            CircleStatus::Active => {}
        }

        let members = Self::load_members(&env)?;
        if !members.contains_key(caller.clone()) && circle.organizer != caller {
            return Err(AjoError::Unauthorized);
        }

        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::VotingForDissolution);
        env.storage().instance().set(&DataKey::DissolutionVote, &DissolutionVote {
            votes_for: 0,
            total_members: circle.member_count,
            threshold_mode,
        });
        env.storage().instance().set(&DataKey::VoteCast, &Map::<Address, bool>::new(&env));
        Ok(())
    }

    pub fn vote_to_dissolve(env: Env, member: Address) -> Result<(), AjoError> {
        member.require_auth();

        if Self::circle_status(&env) != CircleStatus::VotingForDissolution {
            return Err(AjoError::NoActiveVote);
        }

        let members = Self::load_members(&env)?;
        if !members.contains_key(member.clone()) { return Err(AjoError::Unauthorized); }

        let mut vote_cast: Map<Address, bool> = env.storage().instance()
            .get(&DataKey::VoteCast).unwrap_or_else(|| Map::new(&env));
        if vote_cast.get(member.clone()).unwrap_or(false) { return Err(AjoError::AlreadyVoted); }

        vote_cast.set(member.clone(), true);
        env.storage().instance().set(&DataKey::VoteCast, &vote_cast);

        let mut vote: DissolutionVote = env.storage().instance()
            .get(&DataKey::DissolutionVote).ok_or(AjoError::NoActiveVote)?;
        vote.votes_for += 1;

        let threshold_met = if vote.threshold_mode == 1 {
            vote.votes_for * 100 > vote.total_members * 66
        } else {
            vote.votes_for * 2 > vote.total_members
        };

        if threshold_met {
            env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Dissolved);
        }
        env.storage().instance().set(&DataKey::DissolutionVote, &vote);
        Ok(())
    }

    pub fn dissolve_and_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();
        if Self::circle_status(&env) != CircleStatus::Dissolved {
            return Err(AjoError::CircleNotActive);
        }
        Self::do_refund(&env, &member)
    }

    pub fn get_circle_status(env: Env) -> CircleStatus {
        Self::circle_status(&env)
    }

    pub fn get_dissolution_vote(env: Env) -> Result<DissolutionVote, AjoError> {
        env.storage().instance().get(&DataKey::DissolutionVote).ok_or(AjoError::NoActiveVote)
    }

    // ─── Emergency panic button ───────────────────────────────────────────────

    pub fn panic(env: Env, admin: Address) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        match Self::circle_status(&env) {
            CircleStatus::Dissolved => return Err(AjoError::CircleAlreadyDissolved),
            CircleStatus::Panicked => return Err(AjoError::CirclePanicked),
            _ => {}
        }
        env.storage().instance().set(&DataKey::CircleStatus, &CircleStatus::Panicked);
        Ok(())
    }

    pub fn emergency_refund(env: Env, member: Address) -> Result<i128, AjoError> {
        member.require_auth();
        if Self::circle_status(&env) != CircleStatus::Panicked {
            return Err(AjoError::CircleNotActive);
        }
        Self::do_refund(&env, &member)
    }

    pub fn is_panicked(env: Env) -> bool {
        Self::circle_status(&env) == CircleStatus::Panicked
    }

    pub fn is_kyc_verified(env: Env, member: Address) -> bool {
        let kyc: Map<Address, bool> = env.storage().instance()
            .get(&DataKey::KycStatus).unwrap_or_else(|| Map::new(&env));
        kyc.get(member).unwrap_or(false)
    }

    pub fn set_eth_usd_price(env: Env, admin: Address, price: i128, decimals: u32) -> Result<(), AjoError> {
        Self::require_admin(&env, &admin)?;
        if price <= 0 { return Err(AjoError::InvalidInput); }
        env.storage().instance().set(&DataKey::EthUsdPrice, &price);
        env.storage().instance().set(&DataKey::EthUsdDecimals, &decimals);
        Ok(())
    }

    pub fn native_amount_for_usd(env: Env, usd_amount: i128) -> Result<i128, AjoError> {
        if usd_amount <= 0 { return Err(AjoError::InvalidInput); }

        let price: i128 = env.storage().instance()
            .get(&DataKey::EthUsdPrice).ok_or(AjoError::PriceUnavailable)?;
        let decimals: u32 = env.storage().instance()
            .get(&DataKey::EthUsdDecimals).ok_or(AjoError::PriceUnavailable)?;

        let scale = Self::pow10_checked(decimals)?;
        let native = usd_amount.checked_mul(scale).ok_or(AjoError::ArithmeticOverflow)?
            .checked_div(price).ok_or(AjoError::ArithmeticOverflow)?;

        if native <= 0 { return Err(AjoError::InvalidInput); }
        Ok(native)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, token};

    fn setup_circle_with_member(env: &Env) -> (AjoCircleClient<'_>, Address, Address, Address) {
        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(env, &contract_id);

        let organizer = Address::generate(env);
        let member = Address::generate(env);
        let admin = Address::generate(env);
        let token_address = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address);

        token_admin.mint(&organizer, &1000_i128);
        token_admin.mint(&member, &1000_i128);

        client.initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &12_u32, &5_u32);
        client.add_member(&organizer, &member);
        client.contribute(&organizer, &200_i128);
        client.contribute(&member, &200_i128);

        (client, organizer, member, token_address)
    }

    #[test]
    fn enforce_member_limit_at_contract_level() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AjoCircle);
        let client = AjoCircleClient::new(&env, &contract_id);

        let organizer = Address::generate(&env);
        let token_address = Address::generate(&env);

        assert_eq!(client.initialize_circle(&organizer, &token_address, &100_i128, &7_u32, &12_u32, &2_u32), Ok(()));
        assert_eq!(client.add_member(&organizer, &Address::generate(&env)), Ok(()));
        assert_eq!(client.add_member(&organizer, &Address::generate(&env)), Ok(()));
        assert_eq!(client.add_member(&organizer, &Address::generate(&env)), Err(AjoError::CircleAtCapacity));
    }

    #[test]
    fn test_panic_happy_path() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _member, _token) = setup_circle_with_member(&env);

        assert!(!client.is_panicked());
        assert_eq!(client.panic(&organizer), Ok(()));
        assert!(client.is_panicked());
        assert_eq!(client.get_circle_status(), CircleStatus::Panicked);
    }

    #[test]
    fn test_panic_only_organizer() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _organizer, member, _token) = setup_circle_with_member(&env);

        assert_eq!(client.panic(&member), Err(AjoError::Unauthorized));
        assert!(!client.is_panicked());
    }

    #[test]
    fn test_emergency_refund_during_panic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member, token_address) = setup_circle_with_member(&env);
        let token_client = token::Client::new(&env, &token_address);

        assert_eq!(token_client.balance(&member), 800_i128);
        client.panic(&organizer);

        assert_eq!(client.emergency_refund(&member), Ok(200_i128));
        assert_eq!(token_client.balance(&member), 1000_i128);

        assert_eq!(client.emergency_refund(&organizer), Ok(200_i128));
        assert_eq!(token_client.balance(&organizer), 1000_i128);

        assert_eq!(client.emergency_refund(&member), Err(AjoError::InsufficientFunds));
    }

    #[test]
    fn test_emergency_refund_without_panic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _organizer, member, _token) = setup_circle_with_member(&env);

        assert_eq!(client.emergency_refund(&member), Err(AjoError::CircleNotActive));
    }

    #[test]
    fn test_panic_blocks_contribute() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, member, _token) = setup_circle_with_member(&env);

        client.panic(&organizer);
        assert_eq!(client.contribute(&member, &50_i128), Err(AjoError::CirclePanicked));
    }

    #[test]
    fn test_panic_blocks_join() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, organizer, _member, _token) = setup_circle_with_member(&env);

        client.panic(&organizer);
        assert_eq!(client.add_member(&organizer, &Address::generate(&env)), Err(AjoError::CirclePanicked));
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
