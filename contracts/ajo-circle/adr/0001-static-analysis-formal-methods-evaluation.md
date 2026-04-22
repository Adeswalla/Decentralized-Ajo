# ADR 0001: Static Analysis / Formal Methods Evaluation for `ajo-circle`

- **Status:** Accepted (time-boxed)
- **Date:** 2026-04-22
- **Related Issues:**
  - #350 — `[Contracts] Static analysis / formal methods evaluation`
  - #342 — `[Contracts] External security review prep`
- **Scope:** `contracts/ajo-circle/src/lib.rs`

## Context

`ajo-circle` handles fund-moving operations (contributions, payouts, emergency refunds, and governance-controlled state changes). Unit/integration tests provide behavioral confidence, but they do not fully cover all state transitions and arithmetic edge cases.

Issue #350 requested an evaluation of additional assurance methods beyond tests, specifically for Soroban/Rust contract logic.

## Options Evaluated

### 1) `cargo clippy` (static analysis)
- **Pros:**
  - Native Rust tooling, low adoption cost
  - Catches common correctness/safety/code-quality issues
  - Works well in CI/nightly automation
- **Cons:**
  - Not a proof system
  - Rule set is general-purpose, not Soroban-specific

### 2) Kani (bounded model checking)
- **Pros:**
  - Can prove/deny properties for bounded inputs
  - Useful for arithmetic/state invariants on pure Rust logic
- **Cons:**
  - Additional harness work needed for contract-oriented code
  - Current Soroban-targeted workflow integration overhead is non-trivial for this sprint

### 3) MIRAI (abstract interpretation)
- **Pros:**
  - Detects potential panics/invariant violations statically
  - Useful for assertion-driven contracts
- **Cons:**
  - Integration/maintenance overhead for this repository right now
  - Requires dedicated ownership and tuning to avoid noisy output

### 4) Custom runtime invariant assertions only
- **Pros:**
  - Fast to add in hot paths
  - Can catch logic regressions during tests
- **Cons:**
  - Not exhaustive and can still miss state-space bugs

## Decision

Adopt **`cargo clippy` automated checks now** as the immediate low-effort win, and **defer Kani/MIRAI** to a follow-up track under security review prep (#342).

This choice is aligned with the issue time-box (1–2 days) and gives immediate, repeatable assurance in automation.

## Implementation

1. Add a dedicated nightly/static-analysis workflow for `contracts/ajo-circle`.
2. Run:
   - `cargo clippy --all-targets --all-features -- -D warnings`
3. Keep this as a baseline while planning a second-phase formal-methods spike (Kani/MIRAI harness feasibility).

## Consequences

### Positive
- Immediate increase in automated contract quality checks.
- Fast feedback loop for contract changes.
- Minimal disruption to current contributor workflow.

### Negative / Deferred Work
- No full formal proof in this iteration.
- Kani/MIRAI property harnesses are postponed and should be scoped in a follow-up issue tied to #342.

## Follow-up

- Track formal-methods phase as a continuation under #342.
- Candidate properties for a future Kani/MIRAI spike:
  - `total_withdrawn <= total_contributed + payouts_due`
  - `current_round` monotonicity and bounds
  - Pool conservation across `deposit`, `contribute`, `claim_payout`, and refunds
