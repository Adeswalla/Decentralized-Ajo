# Soroban WASM Upgrade and Migration Policy

## Decision
Current operating model: one WASM hash/version per newly deployed circle instance. Existing circle instances are treated as immutable unless an explicit governance + operations migration is executed.

## Why
- Predictable user expectations for savings logic.
- Reduced accidental behavior drift for active circles.
- Easier auditability because each circle can be tied to a pinned wasm hash.

## Upgrade/Migration Process

1. Prepare release candidate
- Build and test new wasm.
- Record contract source commit and wasm hash.
- Run testnet soak period before production use.

2. Governance and approvals
- Multisig sign-off required for production deployment tooling/keys.
- Publish migration proposal with:
  - reason for upgrade,
  - affected circles,
  - timeline,
  - rollback plan.

3. Communication timeline
- Announce to affected users before migration window.
- Freeze risky operations only if required and communicated.
- Post completion notice with final hashes.

4. Backend reconciliation
- Backend must track circle contract version/hash used for writes.
- Validation constants must stay in sync with contract limits (`LIMIT_SYNC_TAG` checks in CI).

## Version Bump Checklist

- [ ] Contract tests pass (`cargo test --lib`)
- [ ] New wasm hash pinned in release notes/ops docs
- [ ] Testnet soak completed
- [ ] Backend validation limits reviewed and synced
- [ ] CI green including limit sync + Postgres migration/smoke
- [ ] User communication drafted and published

## Funds and Legal/Disclosure Note
If community funds are migrated to a new contract instance, provide explicit notice, consent/governance basis, and a clear risk disclosure before execution. Migration authority and responsibilities must be documented in operational runbooks.
