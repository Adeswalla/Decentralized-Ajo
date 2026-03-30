# Smart Contract Security Guidelines

## Reentrancy Protection - Quick Reference

### ✅ ALWAYS Follow: Checks-Effects-Interactions (CEI) Pattern

When writing functions that transfer tokens or make external calls:

```rust
pub fn withdraw_example(env: Env, member: Address, amount: i128) -> Result<i128, AjoError> {
    // 1️⃣ CHECKS - Validate everything first
    member.require_auth();
    
    if amount <= 0 {
        return Err(AjoError::InvalidInput);
    }
    
    let mut members = get_members(&env)?;
    let mut member_data = members.get(member.clone())?;
    
    if member_data.balance < amount {
        return Err(AjoError::InsufficientFunds);
    }
    
    // 2️⃣ EFFECTS - Update ALL state BEFORE external calls
    member_data.balance -= amount;
    member_data.total_withdrawn += amount;
    members.set(member.clone(), member_data);
    env.storage().instance().set(&DataKey::Members, &members);
    
    // 3️⃣ INTERACTIONS - External calls happen LAST
    let token_client = token::Client::new(&env, &token_address);
    token_client.transfer(&env.current_contract_address(), &member, &amount);
    
    Ok(amount)
}
```

---

## ❌ NEVER Do This (Vulnerable Pattern)

```rust
// ⚠️ VULNERABLE - DO NOT USE
pub fn bad_withdraw(env: Env, member: Address, amount: i128) -> Result<i128, AjoError> {
    member.require_auth();
    
    // ❌ External call BEFORE state update
    token_client.transfer(&env.current_contract_address(), &member, &amount);
    
    // ❌ TOO LATE - Attacker can reenter before this executes
    member_data.balance -= amount;
    env.storage().instance().set(&DataKey::Members, &members);
    
    Ok(amount)
}
```

---

## Protected Functions in This Contract

All withdrawal functions now follow CEI pattern:

| Function | Protected | Pattern Applied |
|----------|-----------|-----------------|
| `claim_payout()` | ✅ | CEI |
| `partial_withdraw()` | ✅ | CEI |
| `dissolve_and_refund()` | ✅ | CEI |
| `emergency_refund()` | ✅ | CEI |
| `contribute()` | ✅ | Receive-only (safe) |
| `deposit()` | ✅ | Receive-only (safe) |

---

## Testing Your Changes

### Run Tests
```bash
cd contracts/ajo-circle
cargo test
```

### Check for Issues
```bash
# Lint check
cargo clippy --all-targets --all-features

# Security audit of dependencies
cargo audit

# Build optimized contract
cargo build --target wasm32-unknown-unknown --release
```

---

## Code Review Checklist

When reviewing or writing new functions:

- [ ] Does the function transfer tokens or make external calls?
- [ ] Are ALL state updates completed BEFORE external calls?
- [ ] Is `require_auth()` called at the start?
- [ ] Are all input parameters validated?
- [ ] Are balance checks performed before transfers?
- [ ] Is storage updated before any external interaction?
- [ ] Are there any state changes after external calls? (should be NO)
- [ ] Is the function documented with security notes?

---

## Common Pitfalls

### 1. Forgetting to Save State
```rust
// ❌ BAD - State modified but not saved
member_data.balance -= amount;
// Missing: env.storage().instance().set(...)

token_client.transfer(...);
```

### 2. Multiple External Calls
```rust
// ⚠️ RISKY - Multiple external calls
token_client.transfer(&env.current_contract_address(), &member, &amount);
other_contract.notify(&member); // Second external call
// Any state changes here are vulnerable
```

### 3. Conditional State Updates After External Calls
```rust
// ❌ BAD - State update after external call
token_client.transfer(&env.current_contract_address(), &member, &amount);

if some_condition {
    member_data.status = 2; // Vulnerable!
}
```

---

## Emergency Procedures

### If Vulnerability Discovered

1. **Immediate**: Call `panic()` function (admin only)
   ```rust
   client.panic(&admin_address);
   ```

2. **Notify**: Alert all members through official channels

3. **Assess**: Review transaction history for exploits

4. **Refund**: Members use `emergency_refund()` to safely withdraw
   ```rust
   client.emergency_refund(&member_address);
   ```

5. **Fix**: Deploy patched contract version

6. **Migrate**: Move members to new secure contract

---

## Additional Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)
- [Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)

---

**Last Updated**: March 25, 2026  
**Contract Version**: 0.1.0  
**Security Status**: ✅ Reentrancy Protected
