#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, Address, Map, Vec};

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
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleData {
    pub organizer: Address,
    pub contribution_amount: i128,
    pub frequency_days: u32,
    pub max_rounds: u32,
    pub current_round: u32,
    pub member_count: u32,
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
pub struct MemberStanding {
    pub missed_count: u32,
    pub is_active: bool,
}

#[contracttype]
pub enum DataKey {
    Circle,
    Members,
    Standings,
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    /// Initialize a new Ajo circle
    pub fn initialize_circle(
        env: Env,
        organizer: Address,
        contribution_amount: i128,
        frequency_days: u32,
        max_rounds: u32,
    ) -> Result<(), AjoError> {
        organizer.require_auth();

        if contribution_amount <= 0 || frequency_days == 0 || max_rounds == 0 {
            return Err(AjoError::InvalidInput);
        }

        let circle_data = CircleData {
            organizer: organizer.clone(),
            contribution_amount,
            frequency_days,
            max_rounds,
            current_round: 1,
            member_count: 1,
        };

        env.storage().instance().set(&DataKey::Circle, &circle_data);

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

    /// Add a new member to the circle
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), AjoError> {
        organizer.require_auth();

        let mut circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(AjoError::NotFound)?;

        if circle.organizer != organizer {
            return Err(AjoError::Unauthorized);
        }

        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if members.contains_key(new_member.clone()) {
            return Err(AjoError::AlreadyExists);
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

    /// Record a contribution from a member
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), AjoError> {
        member.require_auth();

        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

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

        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            member_data.total_contributed += amount;
            members.set(member, member_data);
        } else {
            return Err(AjoError::NotFound);
        }

        env.storage().instance().set(&DataKey::Members, &members);

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

        let circle: CircleData = env.storage()
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

        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            if member_data.has_received_payout {
                return Err(AjoError::AlreadyPaid);
            }

            let payout = (circle.member_count as i128) * circle.contribution_amount;

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

        if amount <= 0 {
            return Err(AjoError::InvalidInput);
        }

        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        if let Some(mut member_data) = members.get(member.clone()) {
            let available = member_data.total_contributed - member_data.total_withdrawn;

            if amount > available {
                return Err(AjoError::InsufficientFunds);
            }

            let net_amount = amount - (amount * 10) / 100;
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
        let members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        members.get(member).ok_or(AjoError::NotFound)
    }

    /// Get all members
    pub fn get_members(env: Env) -> Result<Vec<MemberData>, AjoError> {
        let members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(AjoError::NotFound)?;

        let mut members_vec = Vec::new(&env);
        for (_, member) in members.iter() {
            members_vec.push_back(member);
        }

        Ok(members_vec)
    }
}

#[cfg(test)]
mod test;
