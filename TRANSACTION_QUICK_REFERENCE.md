# Transaction Quick Reference Guide

This guide describes the standard transaction flow for the AjoCircle smart contract and API.

## 1. Contribution Flow
- **API**: `/api/circles/[id]/contribute` (POST)
- **Contract**: `contribute(member: Address, amount: i128)`
- **Logic**: Each member contributes the fixed amount for the current round. The `total_pool` increases, and the member's `total_contributed` is updated.

## 2. Payout Flow (ROTATION)
- **API**: `/api/circles/[id]/payout` (POST)
- **Contract**: `claim_payout(member: Address)`
- **Logic**: The contract enforces a sequential payout order using `next_payout_index`. Only once everyone has contributed for the round can the current payee claim their funds.

## 3. Partial Withdrawal (EMERGENCY)
- **API**: `/api/circles/[id]/withdraw` (POST)
- **Contract**: `partial_withdraw(member: Address, amount: i128)`
- **Logic**: Members can withdraw a portion of their *contributed* funds before their payout turn, subject to a **10% penalty** which remains in the pool for other members.

## 4. State Safety
- **Accounting**: The `total_pool` in the contract is the source of truth for available funds.
- **Integrity**: Out-of-turn payout claims are rejected with `Error::NotYourTurn`.
