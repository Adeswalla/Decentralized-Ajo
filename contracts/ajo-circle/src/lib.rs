#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env, Symbol, Address, Map, Vec, BytesN};

// Custom types
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CircleData {
    pub organizer: Address,
    pub contribution_amount: i128,
    pub frequency_days: u32,
    pub max_rounds: u32,
    pub current_round: u32,
    pub next_payout_index: u32, // Track whose turn it is
    pub total_pool: i128,      // Track current funds in accounting
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
pub enum DataKey {
    Circle,
    Member(Address),
    MembersList,
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
        max_members: u32,
    ) -> Result<(), Symbol> {
        organizer.require_auth();

        // Validate inputs
        if contribution_amount <= 0 {
            return Err(symbol_short!("badamt"));
        }
        if frequency_days == 0 {
            return Err(symbol_short!("badfreq"));
        }
        if max_rounds == 0 {
            return Err(symbol_short!("badrnd"));
        }
        if max_members == 0 {
            return Err(symbol_short!("badmax"));
        }

        // Store circle data
        let circle_data = CircleData {
            organizer: organizer.clone(),
            contribution_amount,
            frequency_days,
            max_rounds,
            current_round: 1,
            next_payout_index: 0,
            total_pool: 0,
            member_count: 1, // Organizer is the first member
            max_members,
        };

        env.storage().instance().set(&DataKey::Circle, &circle_data);

        // Initialize member data for organizer
        let member_data = MemberData {
            address: organizer.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        };

        env.storage().persistent().set(&DataKey::Member(organizer.clone()), &member_data);

        // Track members in a list for iteration (capped by max_members)
        let mut members_list: Vec<Address> = Vec::new(&env);
        members_list.push_back(organizer);
        env.storage().instance().set(&DataKey::MembersList, &members_list);

        Ok(())
    }

    /// Add a new member to the circle
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), Symbol> {
        organizer.require_auth();

        // Get current circle
        let mut circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(symbol_short!("nocircle"))?;

        // Only organizer can add members
        if circle.organizer != organizer {
            return Err(symbol_short!("notauth"));
        }

        // Check participant cap
        if circle.member_count >= circle.max_members {
            return Err(symbol_short!("atcap"));
        }

        // Check if member already exists
        let member_key = DataKey::Member(new_member.clone());
        if env.storage().persistent().has(&member_key) {
            return Err(symbol_short!("exists"));
        }

        // Store new member data
        let member_data = MemberData {
            address: new_member.clone(),
            total_contributed: 0,
            total_withdrawn: 0,
            has_received_payout: false,
            status: 0,
        };
        env.storage().persistent().set(&member_key, &member_data);

        // Update member list
        let mut members_list: Vec<Address> = env.storage()
            .instance()
            .get(&DataKey::MembersList)
            .ok_or(symbol_short!("nomembers"))?;
        members_list.push_back(new_member);
        env.storage().instance().set(&DataKey::MembersList, &members_list);

        // Increment member count
        circle.member_count += 1;
        env.storage().instance().set(&DataKey::Circle, &circle);

        Ok(())
    }

    /// Record a contribution from a member
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), Symbol> {
        member.require_auth();

        if amount <= 0 {
            return Err(symbol_short!("badamt"));
        }

        // Verify circle exists
        if !env.storage().instance().has(&DataKey::Circle) {
            return Err(symbol_short!("nocircle"));
        }

        // Fetch and update member data
        let member_key = DataKey::Member(member);
        let mut member_data: MemberData = env.storage()
            .persistent()
            .get(&member_key)
            .ok_or(symbol_short!("notmem"))?;

        member_data.total_contributed += amount;
        env.storage().persistent().set(&member_key, &member_data);

        // Update overall pool
        let mut circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(symbol_short!("nocircle"))?;
        circle.total_pool += amount;
        env.storage().instance().set(&DataKey::Circle, &circle);

        Ok(())
    }

    /// Claim payout when it's a member's turn
    pub fn claim_payout(env: Env, member: Address) -> Result<i128, Symbol> {
        member.require_auth();

        // Get circle data
        let mut circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(symbol_short!("nocircle"))?;

        // 1. Check if circle has ended
        if circle.current_round > circle.max_rounds {
            return Err(symbol_short!("ended"));
        }

        // 2. Enforce payout order
        let members_list: Vec<Address> = env.storage()
            .instance()
            .get(&DataKey::MembersList)
            .ok_or(symbol_short!("nomembers"))?;

        let recipient = members_list.get(circle.next_payout_index).ok_or(symbol_short!("badidx"))?;
        if recipient != member {
            return Err(symbol_short!("noturn"));
        }

        // 3. Get member data
        let member_key = DataKey::Member(member.clone());
        let mut member_data: MemberData = env.storage()
            .persistent()
            .get(&member_key)
            .ok_or(symbol_short!("notmem"))?;

        if member_data.has_received_payout {
            return Err(symbol_short!("alpaid"));
        }

        // 4. Calculate payout and check funds
        let payout = (circle.member_count as i128) * circle.contribution_amount;
        if circle.total_pool < payout {
            return Err(symbol_short!("insufund"));
        }

        // Update states
        circle.total_pool -= payout;
        circle.next_payout_index += 1;

        // Reset index and advance round if everyone has been paid for this round
        if circle.next_payout_index >= circle.member_count {
            circle.next_payout_index = 0;
            circle.current_round += 1;
            
            // To support multiple rounds where members contribute again, 
            // has_received_payout would need to be reset here for all members.
            // For this implementation, a circle with max_rounds = member_count 
            // handles one full rotation correctly.
        }

        member_data.has_received_payout = true;
        member_data.total_withdrawn += payout;

        env.storage().instance().set(&DataKey::Circle, &circle);
        env.storage().persistent().set(&member_key, &member_data);

        Ok(payout)
    }

    /// Perform a partial withdrawal with penalty
    pub fn partial_withdraw(
        env: Env,
        member: Address,
        amount: i128,
    ) -> Result<i128, Symbol> {
        member.require_auth();

        if amount <= 0 {
            return Err(symbol_short!("badamt"));
        }

        let member_key = DataKey::Member(member);
        let mut member_data: MemberData = env.storage()
            .persistent()
            .get(&member_key)
            .ok_or(symbol_short!("notmem"))?;

        let available = member_data.total_contributed - member_data.total_withdrawn;

        if amount > available {
            return Err(symbol_short!("insufund"));
        }

        // Apply 10% penalty
        let penalty_percent = 10i128;
        let penalty = (amount * penalty_percent) / 100;
        let net_amount = amount - penalty;

        member_data.total_withdrawn += amount;
        env.storage().persistent().set(&member_key, &member_data);

        // Update overall pool
        let mut circle: CircleData = env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(symbol_short!("nocircle"))?;
        circle.total_pool -= amount;
        env.storage().instance().set(&DataKey::Circle, &circle);

        Ok(net_amount)
    }

    /// Get circle state
    pub fn get_circle_state(env: Env) -> Result<CircleData, Symbol> {
        env.storage()
            .instance()
            .get(&DataKey::Circle)
            .ok_or(symbol_short!("nocircle"))
    }

    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::Member(member))
            .ok_or(symbol_short!("notmem"))
    }

    pub fn get_members(env: Env) -> Result<Vec<MemberData>, Symbol> {
        let members_list: Vec<Address> = env.storage()
            .instance()
            .get(&DataKey::MembersList)
            .ok_or(symbol_short!("nomembers"))?;

        let mut members_data = Vec::new(&env);
        for address in members_list.iter() {
            if let Some(member) = env.storage().persistent().get(&DataKey::Member(address)) {
                members_data.push_back(member);
            }
        }

        Ok(members_data)
    }
}

mod test;
