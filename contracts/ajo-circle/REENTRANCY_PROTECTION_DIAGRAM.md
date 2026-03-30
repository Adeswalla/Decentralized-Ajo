# Reentrancy Protection - Visual Guide

## Attack vs Protection Comparison

### ❌ VULNERABLE CODE (Before Fix)

```
┌─────────────────────────────────────────────────────────────┐
│  claim_payout() - VULNERABLE PATTERN                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Member calls claim_payout()
   │
   ├─> ✓ Check: member.require_auth()
   ├─> ✓ Check: Circle not panicked
   ├─> ✓ Check: Member is active
   ├─> ✓ Check: has_received_payout == false ✓
   │
Step 2: Calculate payout amount
   │
Step 3: ⚠️  DANGER - External call FIRST
   │
   └─> token_client.transfer(contract → member, 1000 tokens)
          │
          └─> 🔴 ATTACKER'S MALICIOUS TOKEN HOOK EXECUTES
                 │
                 └─> Calls claim_payout() AGAIN
                        │
                        ├─> ✓ Check: has_received_payout == false (STILL!)
                        ├─> ✓ All checks pass again
                        └─> 💰 Second payout succeeds!
                               │
                               └─> 🔴 ATTACKER DRAINS CONTRACT
   
Step 4: ❌ TOO LATE - Update state
   │
   ├─> member_data.has_received_payout = true
   └─> member_data.total_withdrawn += payout

Result: 💥 FUNDS STOLEN - Attacker got multiple payouts
```

---

### ✅ SECURE CODE (After Fix)

```
┌─────────────────────────────────────────────────────────────┐
│  claim_payout() - SECURE PATTERN (CEI)                      │
└─────────────────────────────────────────────────────────────┘

Step 1: CHECKS - Validate everything
   │
   ├─> ✓ Check: member.require_auth()
   ├─> ✓ Check: Circle not panicked
   ├─> ✓ Check: Member is active
   ├─> ✓ Check: has_received_payout == false ✓
   │
Step 2: EFFECTS - Update state FIRST
   │
   ├─> member_data.has_received_payout = true ✅
   ├─> member_data.total_withdrawn += payout ✅
   ├─> members.set(member, member_data) ✅
   └─> env.storage().instance().set(...) ✅
   
Step 3: INTERACTIONS - External call LAST
   │
   └─> token_client.transfer(contract → member, 1000 tokens)
          │
          └─> 🔴 ATTACKER TRIES MALICIOUS HOOK
                 │
                 └─> Calls claim_payout() AGAIN
                        │
                        ├─> ✓ Check: has_received_payout == true ❌
                        └─> ❌ REJECTED: AlreadyPaid error
                               │
                               └─> 🛡️  ATTACK BLOCKED!

Result: ✅ FUNDS SAFE - Attacker gets only one payout
```

---

## Function Protection Status

### Withdrawal Functions (Outgoing Transfers)

```
┌──────────────────────────┬──────────┬─────────────────┐
│ Function                 │ Status   │ Protection      │
├──────────────────────────┼──────────┼─────────────────┤
│ claim_payout()           │ ✅ SAFE  │ CEI Pattern     │
│ partial_withdraw()       │ ✅ SAFE  │ CEI Pattern     │
│ dissolve_and_refund()    │ ✅ SAFE  │ CEI Pattern     │
│ emergency_refund()       │ ✅ SAFE  │ CEI Pattern     │
└──────────────────────────┴──────────┴─────────────────┘
```

### Deposit Functions (Incoming Transfers)

```
┌──────────────────────────┬──────────┬─────────────────┐
│ Function                 │ Status   │ Protection      │
├──────────────────────────┼──────────┼─────────────────┤
│ contribute()             │ ✅ SAFE  │ Receive-only    │
│ deposit()                │ ✅ SAFE  │ Receive-only    │
└──────────────────────────┴──────────┴─────────────────┘

Note: Receiving funds is inherently safe from reentrancy
```

---

## CEI Pattern Breakdown

### The Three Phases

```
┌─────────────────────────────────────────────────────────────┐
│                    CEI PATTERN                              │
└─────────────────────────────────────────────────────────────┘

1️⃣  CHECKS
    ├─ Validate caller authorization
    ├─ Check contract state/status
    ├─ Verify input parameters
    ├─ Validate balances/amounts
    └─ Ensure preconditions met
    
    ⬇️  All checks passed
    
2️⃣  EFFECTS
    ├─ Update balances
    ├─ Modify state variables
    ├─ Set status flags
    ├─ Update mappings
    └─ PERSIST TO STORAGE ⚠️  CRITICAL
    
    ⬇️  State is now secure
    
3️⃣  INTERACTIONS
    ├─ Transfer tokens
    ├─ Call external contracts
    └─ Emit events
    
    ⬇️  Even if reentrancy occurs, state is protected
```

---

## State Update Sequence

### claim_payout() Example

```
BEFORE (Vulnerable):
┌──────────────────────────────────────────────────────────┐
│ State: has_received_payout = false                       │
│        total_withdrawn = 0                               │
└──────────────────────────────────────────────────────────┘
                    ⬇️
         ⚠️  token_client.transfer()
                    ⬇️
         🔴 REENTRANCY WINDOW HERE
                    ⬇️
┌──────────────────────────────────────────────────────────┐
│ State: has_received_payout = true                        │
│        total_withdrawn = 1000                            │
└──────────────────────────────────────────────────────────┘


AFTER (Secure):
┌──────────────────────────────────────────────────────────┐
│ State: has_received_payout = false                       │
│        total_withdrawn = 0                               │
└──────────────────────────────────────────────────────────┘
                    ⬇️
┌──────────────────────────────────────────────────────────┐
│ State: has_received_payout = true  ✅                    │
│        total_withdrawn = 1000      ✅                    │
└──────────────────────────────────────────────────────────┘
                    ⬇️
         ✅ token_client.transfer()
                    ⬇️
         🛡️  NO REENTRANCY RISK - State already updated
```

---

## Attack Scenarios Prevented

### Scenario 1: Double Payout Attack
```
❌ BEFORE FIX:
Attacker → claim_payout()
         → Receives 1000 tokens
         → Reenters claim_payout()
         → Receives 1000 tokens AGAIN
         → Total stolen: 2000 tokens

✅ AFTER FIX:
Attacker → claim_payout()
         → State updated (has_received_payout = true)
         → Receives 1000 tokens
         → Tries to reenter claim_payout()
         → ❌ REJECTED: AlreadyPaid
         → Total received: 1000 tokens (correct)
```

### Scenario 2: Partial Withdrawal Drain
```
❌ BEFORE FIX:
Attacker → partial_withdraw(500)
         → Receives 450 tokens (after 10% penalty)
         → Reenters partial_withdraw(500)
         → Receives 450 tokens AGAIN
         → Repeats until contract drained

✅ AFTER FIX:
Attacker → partial_withdraw(500)
         → State updated (total_withdrawn += 500)
         → Receives 450 tokens
         → Tries to reenter partial_withdraw(500)
         → ❌ REJECTED: InsufficientFunds
         → Total received: 450 tokens (correct)
```

### Scenario 3: Emergency Refund Exploit
```
❌ BEFORE FIX:
During panic mode:
Attacker → emergency_refund()
         → Receives full refund
         → Reenters emergency_refund()
         → Receives refund AGAIN
         → Drains emergency funds

✅ AFTER FIX:
During panic mode:
Attacker → emergency_refund()
         → State updated (total_withdrawn += refund)
         → Receives full refund
         → Tries to reenter emergency_refund()
         → ❌ REJECTED: InsufficientFunds
         → Total received: One refund (correct)
```

---

## Code Pattern Recognition

### How to Spot Vulnerable Code

```rust
// 🔴 RED FLAG PATTERN - VULNERABLE
pub fn withdraw(env: Env, member: Address, amount: i128) {
    // Checks
    validate_member(&member);
    
    // ⚠️  DANGER: External call BEFORE state update
    token_client.transfer(&contract, &member, &amount);
    
    // ❌ TOO LATE: State update AFTER external call
    member_data.balance -= amount;
    save_state(&member_data);
}
```

```rust
// ✅ GREEN FLAG PATTERN - SECURE
pub fn withdraw(env: Env, member: Address, amount: i128) {
    // Checks
    validate_member(&member);
    
    // ✅ GOOD: State update FIRST
    member_data.balance -= amount;
    save_state(&member_data);
    
    // ✅ GOOD: External call LAST
    token_client.transfer(&contract, &member, &amount);
}
```

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════╗
║           REENTRANCY PROTECTION CHECKLIST                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✅ DO:                                                   ║
║     • Update state BEFORE external calls                 ║
║     • Persist to storage BEFORE transfers                ║
║     • Follow CEI pattern religiously                     ║
║     • Add security comments to code                      ║
║     • Test for reentrancy attacks                        ║
║                                                           ║
║  ❌ DON'T:                                                ║
║     • Make external calls before state updates           ║
║     • Assume Soroban is immune to reentrancy            ║
║     • Skip security documentation                        ║
║     • Deploy without testing                             ║
║     • Ignore code review feedback                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Summary

All withdrawal functions in the Ajo Circle contract now follow the Checks-Effects-Interactions pattern, making them resistant to reentrancy attacks. The contract is significantly more secure and follows industry best practices.

**Protection Level**: 🛡️🛡️🛡️🛡️🛡️ (5/5)

---

**Document Version**: 1.0  
**Last Updated**: March 25, 2026  
**Contract Version**: 0.1.0
