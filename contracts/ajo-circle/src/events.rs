//! # Structured Event Logging for Ajo Circle
//! Optimized event topics and binary payloads for off-chain indexers

use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

// ============================================================================
// EVENT TOPIC CONSTANTS
// ============================================================================
// These symbols serve as the primary topic for event categorization.
// Indexers can filter by these topics without parsing raw data.

/// Circle lifecycle events
pub const TOPIC_CIRCLE: Symbol = symbol_short!("circle");
/// Member-related events
pub const TOPIC_MEMBER: Symbol = symbol_short!("member");
/// Contribution/deposit events
pub const TOPIC_CONTRIBUTE: Symbol = symbol_short!("contrib");
/// Withdrawal/payout events
pub const TOPIC_WITHDRAW: Symbol = symbol_short!("withdraw");
/// Governance/voting events
pub const TOPIC_GOVERNANCE: Symbol = symbol_short!("gov");
/// Administrative events
pub const TOPIC_ADMIN: Symbol = symbol_short!("admin");
/// Role management events
pub const TOPIC_ROLE: Symbol = symbol_short!("role");
/// Fee configuration events
pub const TOPIC_FEE: Symbol = symbol_short!("fee");

// ============================================================================
// EVENT SUBTOPIC CONSTANTS
// ============================================================================
// Secondary topics for more granular filtering

pub const SUB_INIT: Symbol = symbol_short!("init");
pub const SUB_JOIN: Symbol = symbol_short!("join");
pub const SUB_ADD: Symbol = symbol_short!("add");
pub const SUB_DEPOSIT: Symbol = symbol_short!("deposit");
pub const SUB_PAYOUT: Symbol = symbol_short!("payout");
pub const SUB_PARTIAL: Symbol = symbol_short!("partial");
pub const SUB_EMERGENCY: Symbol = symbol_short!("emergency");
pub const SUB_DISSOLVE: Symbol = symbol_short!("dissolve");
pub const SUB_VOTE: Symbol = symbol_short!("vote");
pub const SUB_PANIC: Symbol = symbol_short!("panic");
pub const SUB_RESUME: Symbol = symbol_short!("resume");
pub const SUB_GRANT: Symbol = symbol_short!("grant");
pub const SUB_REVOKE: Symbol = symbol_short!("revoke");
pub const SUB_SET: Symbol = symbol_short!("set");
pub const SUB_REFUND: Symbol = symbol_short!("refund");

// ============================================================================
// STRUCTURED EVENT DATA TYPES
// ============================================================================
// These types define the binary payload format for each event category.
// Using contracttype ensures consistent serialization for indexers.

/// Circle initialization event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleInitEvent {
    pub organizer: Address,
    pub token_address: Address,
    pub contribution_amount: i128,
    pub frequency_days: u32,
    pub max_rounds: u32,
    pub max_members: u32,
    pub timestamp: u64,
}

/// Member join/add event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberEvent {
    pub member: Address,
    pub member_count: u32,
    pub timestamp: u64,
}

/// Contribution/deposit event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionEvent {
    pub member: Address,
    pub amount: i128,
    pub round: u32,
    pub total_contributed: i128,
    pub timestamp: u64,
}

/// Concise contribution payload — omits Address (already in topic) to avoid
/// buffer-size failures for large contributions.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionPayload {
    pub amount: i128,
    pub round: u32,
    pub total_contributed: i128,
    pub timestamp: u64,
}

/// Withdrawal/payout event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalEvent {
    pub member: Address,
    pub amount: i128,
    pub cycle: u32,
    pub current_round: u32,
    pub timestamp: u64,
}

/// Partial withdrawal event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PartialWithdrawalEvent {
    pub member: Address,
    pub amount: i128,
    pub penalty: i128,
    pub net_amount: i128,
    pub timestamp: u64,
}

/// Emergency refund event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyRefundEvent {
    pub member: Address,
    pub amount: i128,
    pub reason: Symbol,
    pub timestamp: u64,
}

/// Governance vote event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteEvent {
    pub voter: Address,
    pub votes_for: u32,
    pub total_votes: u32,
    pub threshold_mode: u32,
    pub timestamp: u64,
}

/// Dissolution event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DissolutionEvent {
    pub initiator: Address,
    pub threshold_mode: u32,
    pub total_members: u32,
    pub timestamp: u64,
}

/// Circle status change event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StatusChangeEvent {
    pub previous_status: u32,
    pub new_status: u32,
    pub triggered_by: Address,
    pub timestamp: u64,
}

/// Role change event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleEvent {
    pub member: Address,
    pub role: Symbol,
    pub granted_by: Address,
    pub timestamp: u64,
}

/// Fee configuration event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfigEvent {
    pub treasury: Address,
    pub fee_bps: u32,
    pub previous_fee_bps: u32,
    pub timestamp: u64,
}

/// Member removed event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberRemovedEvent {
    pub member: Address,
    pub refund_amount: i128,
    pub timestamp: u64,
}

/// Circle closed event data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircleClosedEvent {
    pub closed_by: Address,
    pub residual_distributed: i128,
    pub timestamp: u64,
}

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================
// Helper functions to ensure consistent event formatting across the contract

/// Emit circle initialization event
pub fn emit_circle_initialized(env: &Env, data: &CircleInitEvent) {
    env.events().publish(
        (TOPIC_CIRCLE, SUB_INIT, data.organizer.clone()),
        data.clone(),
    );
}

/// Emit member joined event
pub fn emit_member_joined(env: &Env, data: &MemberEvent) {
    env.events().publish(
        (TOPIC_MEMBER, SUB_JOIN, data.member.clone()),
        data.clone(),
    );
}

/// Emit member added event
pub fn emit_member_added(env: &Env, data: &MemberEvent) {
    env.events().publish(
        (TOPIC_MEMBER, SUB_ADD, data.member.clone()),
        data.clone(),
    );
}

/// Emit contribution event — member address is in the topic; payload is concise scalars only.
pub fn emit_contribution(env: &Env, data: &ContributionEvent) {
    env.events().publish(
        (TOPIC_CONTRIBUTE, data.member.clone()),
        ContributionPayload {
            amount: data.amount,
            round: data.round,
            total_contributed: data.total_contributed,
            timestamp: data.timestamp,
        },
    );
}

/// Emit deposit event — member address is in the topic; payload is concise scalars only.
pub fn emit_deposit(env: &Env, data: &ContributionEvent) {
    env.events().publish(
        (TOPIC_CONTRIBUTE, SUB_DEPOSIT, data.member.clone()),
        ContributionPayload {
            amount: data.amount,
            round: data.round,
            total_contributed: data.total_contributed,
            timestamp: data.timestamp,
        },
    );
}

/// Emit payout/withdrawal event
pub fn emit_payout(env: &Env, data: &WithdrawalEvent) {
    env.events().publish(
        (TOPIC_WITHDRAW, SUB_PAYOUT, data.member.clone()),
        data.clone(),
    );
}

/// Emit partial withdrawal event
pub fn emit_partial_withdrawal(env: &Env, data: &PartialWithdrawalEvent) {
    env.events().publish(
        (TOPIC_WITHDRAW, SUB_PARTIAL, data.member.clone()),
        data.clone(),
    );
}

/// Emit emergency refund event
pub fn emit_emergency_refund(env: &Env, data: &EmergencyRefundEvent) {
    env.events().publish(
        (TOPIC_WITHDRAW, SUB_EMERGENCY, SUB_REFUND, data.member.clone()),
        data.clone(),
    );
}

/// Emit dissolution vote started event
pub fn emit_dissolution_started(env: &Env, data: &DissolutionEvent) {
    env.events().publish(
        (TOPIC_GOVERNANCE, SUB_DISSOLVE, SUB_INIT),
        data.clone(),
    );
}

/// Emit dissolution passed event
pub fn emit_dissolution_passed(env: &Env, timestamp: u64) {
    env.events().publish(
        (TOPIC_GOVERNANCE, SUB_DISSOLVE, symbol_short!("passed")),
        timestamp,
    );
}

/// Emit vote cast event
pub fn emit_vote_cast(env: &Env, data: &VoteEvent) {
    env.events().publish(
        (TOPIC_GOVERNANCE, SUB_VOTE, data.voter.clone()),
        data.clone(),
    );
}

/// Emit panic event
pub fn emit_panic(env: &Env, triggered_by: &Address, timestamp: u64) {
    env.events().publish(
        (TOPIC_ADMIN, SUB_PANIC, triggered_by.clone()),
        timestamp,
    );
}

/// Emit resume event
pub fn emit_resume(env: &Env, triggered_by: &Address, timestamp: u64) {
    env.events().publish(
        (TOPIC_ADMIN, SUB_RESUME, triggered_by.clone()),
        timestamp,
    );
}

/// Emit role granted event
pub fn emit_role_granted(env: &Env, data: &RoleEvent) {
    env.events().publish(
        (TOPIC_ROLE, SUB_GRANT, data.member.clone()),
        data.clone(),
    );
}

/// Emit role revoked event
pub fn emit_role_revoked(env: &Env, data: &RoleEvent) {
    env.events().publish(
        (TOPIC_ROLE, SUB_REVOKE, data.member.clone()),
        data.clone(),
    );
}

/// Emit fee configuration event
pub fn emit_fee_config(env: &Env, data: &FeeConfigEvent) {
    env.events().publish(
        (TOPIC_FEE, SUB_SET, data.treasury.clone()),
        data.clone(),
    );
}

/// Emit member removed event
pub fn emit_member_removed(env: &Env, data: &MemberRemovedEvent) {
    env.events().publish(
        (TOPIC_MEMBER, symbol_short!("remove"), data.member.clone()),
        data.clone(),
    );
}

/// Emit circle closed event
pub fn emit_circle_closed(env: &Env, data: &CircleClosedEvent) {
    env.events().publish(
        (TOPIC_CIRCLE, symbol_short!("closed"), data.closed_by.clone()),
        data.clone(),
    );
}

/// Emit circle status change event
pub fn emit_status_change(env: &Env, data: &StatusChangeEvent) {
    env.events().publish(
        (TOPIC_CIRCLE, symbol_short!("status")),
        data.clone(),
    );
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================
// These functions maintain backward compatibility for existing event consumers
// while migrating to the new structured format

/// Legacy event format for backward compatibility
pub fn emit_legacy_deposit(env: &Env, member: &Address, amount: i128, round: u32) {
    env.events().publish(
        (symbol_short!("deposit"), member.clone()),
        (amount, round),
    );
}

/// Legacy event format for backward compatibility
pub fn emit_legacy_withdraw(env: &Env, member: &Address, amount: i128, cycle: u32, current_round: u32) {
    env.events().publish(
        (symbol_short!("withdraw"), member.clone(), env.current_contract_address()),
        (amount, cycle, current_round),
    );
}
