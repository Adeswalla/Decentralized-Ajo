# Mainnet Readiness Checklist

## Overview

This checklist ensures operational readiness before deploying the Ajo Circle smart contract to Stellar mainnet with real funds. Testnet assumptions (free XLM, loose limits) do not carry over to production.

**Status**: 🟡 In Progress  
**Last Updated**: 2026-04-23  
**Testnet Soak Duration**: [TO BE RECORDED]  
**Sign-off Required**: Maintainer Team

---

## 1. Footprint & Budget Analysis ⚙️

### Transaction Footprint Analysis

| Operation | Read Bytes | Write Bytes | CPU Instructions | Estimated Fee (XLM) |
|-----------|-----------|-------------|------------------|---------------------|
| `initialize_circle` | ~2KB | ~1KB | ~500K | ~0.0001 |
| `join_circle` | ~1KB | ~500B | ~200K | ~0.00005 |
| `deposit` | ~800B | ~400B | ~150K | ~0.00003 |
| `claim_payout` | ~1.5KB | ~600B | ~300K | ~0.00006 |
| `shuffle_rotation` | ~2KB | ~1KB | ~400K | ~0.00008 |
| `panic` | ~500B | ~200B | ~100K | ~0.00002 |

**Worst-Case Transaction**: `shuffle_rotation` with 100 members
- Estimated footprint: ~10KB read, ~5KB write
- Estimated CPU: ~2M instructions
- Estimated fee: ~0.0005 XLM

### Action Items
- [ ] Run footprint analysis on all functions with max capacity (100 members)
- [ ] Document worst-case scenarios in deployment guide
- [ ] Test with actual mainnet fee structure
- [ ] Verify fee buffer in frontend (recommend 2x estimated fee)

### Fee Sponsorship Plan

**Decision**: ❌ No fee sponsorship initially

**Rationale**:
- Members pay their own transaction fees
- Keeps contract simple and decentralized
- Fees are minimal (<$0.01 per transaction)

**Future Consideration**: If needed, implement fee sponsorship via:
- Dedicated sponsor account
- Fee pool funded by circle organizer
- Requires contract upgrade

---

## 2. Asset Configuration 💰

### Supported Assets

| Asset | Issuer | Decimals | Status | Notes |
|-------|--------|----------|--------|-------|
| USDC | GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN | 7 | ✅ Recommended | Circle USDC on Stellar |
| XLM | Native | 7 | ✅ Supported | Native Stellar Lumens |
| Custom | TBD | Varies | ⚠️ Verify | Requires manual verification |

### Asset Allowlist Policy

**Policy**: Permissionless - any Stellar Asset Contract (SAC) can be used

**Verification Requirements**:
1. Token contract must implement standard SAC interface
2. Decimal precision must be verified and documented
3. Organizer responsible for asset selection
4. Frontend should warn for non-standard assets

### Decimal Verification

```rust
// Contract expects amounts in token's native decimals
// Example: 100 USDC = 100_0000000 (7 decimals)
contribution_amount: i128 = 100_0000000;
```

**Frontend Responsibility**:
- Query token decimals via `decimals()` function
- Convert user input to correct decimal representation
- Display amounts with proper formatting

### Action Items
- [ ] Document recommended assets (USDC, XLM) in deployment guide
- [ ] Add asset verification checklist for organizers
- [ ] Implement decimal query in frontend
- [ ] Add warning UI for non-standard assets
- [ ] Test with multiple asset types on testnet

---

## 3. Network Configuration 🌐

### Mainnet Parameters

```env
# Mainnet Configuration
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
NEXT_PUBLIC_AJO_CONTRACT_ADDRESS=[DEPLOY_AND_UPDATE]
```

### RPC Provider Considerations

**Primary**: Stellar Foundation RPC
- URL: `https://soroban.stellar.org`
- Rate limits: [Document actual limits]
- Reliability: High

**Backup Options**:
- Self-hosted RPC node
- Third-party providers (e.g., Validation Cloud, Blockdaemon)

### Action Items
- [ ] Document RPC rate limits
- [ ] Test RPC failover strategy
- [ ] Monitor RPC uptime and latency
- [ ] Set up alerts for RPC issues

---

## 4. Security Audit 🔒

### Pre-Deployment Security Checklist

- [ ] **Code Audit**: Professional security audit completed
- [ ] **Static Analysis**: Clippy warnings resolved (baseline: zero warnings)
- [ ] **Fuzz Testing**: Critical functions fuzz tested
- [ ] **Reentrancy**: CEI pattern verified in all fund transfers
- [ ] **Authorization**: All privileged functions have `require_auth()`
- [ ] **Overflow Protection**: Checked arithmetic on all calculations
- [ ] **Emergency Controls**: Panic mechanism tested
- [ ] **Upgrade Path**: WASM upgrade policy documented

### Known Issues & Mitigations

| Issue | Severity | Mitigation | Status |
|-------|----------|------------|--------|
| Rotation randomness | Low | Uses ledger sequence + tx hash | ✅ Documented |
| Oracle dependency | Medium | Admin-controlled price feed | ⚠️ Consider Chainlink |
| Centralized admin | Medium | Multi-sig recommended | 📋 Planned |

### Action Items
- [ ] Complete professional security audit
- [ ] Resolve all high/critical findings
- [ ] Document all medium/low findings with mitigations
- [ ] Publish audit report

---

## 5. Incident Response Plan 🚨

### Incident Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| Lead Developer | [EMAIL] | Technical decisions |
| Security Lead | [EMAIL] | Security incidents |
| Operations | [EMAIL] | Monitoring & alerts |
| Community Manager | [EMAIL] | User communication |

### Emergency Procedures

#### Level 1: Minor Issue (UI bug, display error)
- **Response Time**: 24 hours
- **Action**: Fix and deploy frontend update
- **Communication**: GitHub issue

#### Level 2: Moderate Issue (RPC outage, slow transactions)
- **Response Time**: 4 hours
- **Action**: Switch to backup RPC, investigate
- **Communication**: Status page update

#### Level 3: Critical Issue (fund safety risk, exploit detected)
- **Response Time**: Immediate
- **Action**: 
  1. Trigger `panic()` on affected circles
  2. Halt new circle creation
  3. Investigate and patch
  4. Coordinate emergency refunds
- **Communication**: All channels (email, Discord, Twitter)

### Pause/Upgrade Policy

**Pause Mechanism**:
- Admin can call `panic()` to halt all operations
- Members can claim emergency refunds during panic
- No time limit on panic state

**Upgrade Policy**:
- Contract is upgradeable via WASM hash update
- Requires deployer authorization
- State migration plan documented in `WASM_UPGRADE_POLICY.md`
- Minimum 7-day notice for non-emergency upgrades

### Action Items
- [ ] Finalize incident contact list
- [ ] Set up 24/7 monitoring and alerts
- [ ] Create runbook for each incident level
- [ ] Test panic mechanism on testnet
- [ ] Document upgrade procedure
- [ ] Establish communication channels

---

## 6. Testnet Soak Testing 🧪

### Soak Test Requirements

**Duration**: Minimum 30 days on testnet

**Test Scenarios**:
- [ ] Full circle lifecycle (initialization → rounds → completion)
- [ ] Maximum capacity (100 members)
- [ ] Concurrent operations (multiple deposits, claims)
- [ ] Edge cases (missed contributions, partial withdrawals)
- [ ] Governance (dissolution voting)
- [ ] Emergency scenarios (panic, refunds)
- [ ] Network stress (high gas, RPC delays)

### Soak Test Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Circles Created | 10+ | [TBD] | ⏳ |
| Total Members | 100+ | [TBD] | ⏳ |
| Successful Deposits | 500+ | [TBD] | ⏳ |
| Successful Payouts | 50+ | [TBD] | ⏳ |
| Zero Critical Bugs | ✅ | [TBD] | ⏳ |
| Uptime | >99% | [TBD] | ⏳ |

### Testnet Soak Log

**Start Date**: [TO BE RECORDED]  
**End Date**: [TO BE RECORDED]  
**Duration**: [TO BE CALCULATED]

**Notable Events**:
- [Date]: [Event description]
- [Date]: [Event description]

### Action Items
- [ ] Deploy to testnet with production configuration
- [ ] Run automated test suite daily
- [ ] Recruit beta testers for real-world usage
- [ ] Monitor and log all transactions
- [ ] Document all issues and resolutions
- [ ] Verify 30-day soak period completed

---

## 7. Documentation & Training 📚

### Required Documentation

- [x] Contract README with full API reference
- [x] Security guidelines and threat model
- [x] Deployment security checklist
- [ ] Mainnet deployment guide (this document)
- [ ] User guide for circle organizers
- [ ] User guide for circle members
- [ ] Troubleshooting guide
- [ ] FAQ

### Training Materials

- [ ] Video tutorial: Creating a circle
- [ ] Video tutorial: Joining and contributing
- [ ] Video tutorial: Claiming payouts
- [ ] Admin training: Emergency procedures
- [ ] Developer guide: Integration with frontend

### Action Items
- [ ] Complete all documentation
- [ ] Review documentation for accuracy
- [ ] Publish documentation to public wiki
- [ ] Create training videos
- [ ] Conduct team training session

---

## 8. Monitoring & Observability 📊

### Metrics to Monitor

**Contract Metrics**:
- Total circles created
- Total members across all circles
- Total value locked (TVL)
- Transaction success rate
- Average transaction fees

**System Metrics**:
- RPC response time
- RPC error rate
- Frontend uptime
- API response time
- Database query performance

**Security Metrics**:
- Failed authorization attempts
- Panic events triggered
- Emergency refunds issued
- Unusual transaction patterns

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| RPC Error Rate | >5% | >10% |
| Transaction Failure Rate | >2% | >5% |
| API Response Time | >1s | >3s |
| Failed Auth Attempts | >10/min | >50/min |

### Action Items
- [ ] Set up monitoring dashboard (Grafana/Datadog)
- [ ] Configure alerts for all critical metrics
- [ ] Test alert delivery
- [ ] Document alert response procedures
- [ ] Set up on-call rotation

---

## 9. Legal & Compliance ⚖️

### Regulatory Considerations

- [ ] Review applicable regulations (FinCEN, SEC, local laws)
- [ ] Determine if money transmitter license required
- [ ] Implement KYC/AML if required
- [ ] Draft terms of service
- [ ] Draft privacy policy
- [ ] Consult legal counsel

### Disclaimers

**Required Disclaimers**:
- Smart contract risks (bugs, exploits)
- No guarantee of funds
- Experimental technology
- User responsibility for private keys
- No FDIC insurance or equivalent

### Action Items
- [ ] Legal review completed
- [ ] Terms of service published
- [ ] Privacy policy published
- [ ] Disclaimers added to UI
- [ ] User acceptance flow implemented

---

## 10. Launch Checklist 🚀

### Pre-Launch (T-7 days)

- [ ] All checklist items above completed
- [ ] Security audit published
- [ ] Testnet soak period completed (30+ days)
- [ ] Documentation published
- [ ] Monitoring and alerts configured
- [ ] Incident response team briefed
- [ ] Legal review completed
- [ ] Marketing materials prepared

### Launch Day (T-0)

- [ ] Deploy contract to mainnet
- [ ] Verify contract deployment
- [ ] Update frontend configuration
- [ ] Deploy frontend to production
- [ ] Verify end-to-end functionality
- [ ] Announce launch
- [ ] Monitor closely for 24 hours

### Post-Launch (T+1 to T+30)

- [ ] Daily monitoring and check-ins
- [ ] Collect user feedback
- [ ] Address any issues promptly
- [ ] Publish weekly status updates
- [ ] Plan for future improvements

---

## Sign-Off

### Maintainer Team Approval

| Name | Role | Signature | Date |
|------|------|-----------|------|
| [Name] | Lead Developer | _________ | ____ |
| [Name] | Security Lead | _________ | ____ |
| [Name] | Operations | _________ | ____ |
| [Name] | Legal Counsel | _________ | ____ |

**Final Approval**: ⬜ Ready for Mainnet Deployment

---

## References

### Codebase
- `README.md` - Project overview
- `contracts/ajo-circle/README.md` - Contract documentation
- `contracts/ajo-circle/SECURITY_GUIDELINES.md` - Security best practices
- `contracts/ajo-circle/DEPLOYMENT_SECURITY_CHECKLIST.md` - Deployment checklist
- `contracts/ajo-circle/WASM_UPGRADE_POLICY.md` - Upgrade procedures

### External Resources
- [Stellar Mainnet Documentation](https://developers.stellar.org/docs)
- [Soroban Best Practices](https://developers.stellar.org/docs/smart-contracts/best-practices)
- [Stellar Asset Contract (SAC) Spec](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- [Soroban Fee Structure](https://developers.stellar.org/docs/smart-contracts/fees-and-metering)

---

**Document Version**: 1.0  
**Last Review**: 2026-04-23  
**Next Review**: Before mainnet deployment
