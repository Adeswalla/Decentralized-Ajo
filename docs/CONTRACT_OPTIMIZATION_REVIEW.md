# Soroban Storage/CPU Optimization Review

Scope: `contracts/ajo-circle/src/lib.rs` hot paths (`contribute`/`deposit`, `claim_payout`, vote and role updates).

## Goal
Reduce host calls and storage churn without changing public behavior.

## Findings

1. Existing wins already present
- `claim_payout` follows checks-effects-interactions and updates state before token transfer.
- `shuffle_rotation` already converts to native vector for lower host-call overhead in the shuffle loop.

2. Remaining low-risk opportunities
- Cache instance storage handle in hot functions where multiple `env.storage().instance()` calls are made.
- In `deposit`/`contribute`, read circle fields into locals once (e.g., `contribution_amount`, `member_count`) and reuse.
- In vote/role membership scans, avoid repeated map lookups by loading collection once and mutating in-memory before one final write.

3. Trade-offs
- Minor code complexity increase.
- Must preserve event payloads and error order to avoid semantic drift for indexers/integrations.

## Behavior Safety Guardrails

- No public function signature changes.
- No event shape/name changes.
- Keep existing error enum semantics and precedence where already relied on by clients.

## Measurement Plan (measure first)

Suggested baseline/after comparison:
- Build wasm release and collect instruction/storage footprint via Soroban simulation tooling available in your environment.
- Compare `contribute` and `claim_payout` with identical fixtures.

Example local loop:

```bash
cd contracts/ajo-circle
cargo build --target wasm32-unknown-unknown --release
cargo test --lib
```

If using Soroban CLI simulation tools, capture before/after instruction counts in PR notes.

## Optional Micro-Benchmark Script

Use this helper for consistent local runs:

```bash
scripts/bench-ajo-circle.sh
```

This script is intentionally minimal and avoids changing contract semantics.
