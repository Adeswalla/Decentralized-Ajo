# 🔐 Multisig Authorization System

> Multi-signature authorization for high-value withdrawals in Ajo circles

## Overview

This implementation adds a robust multi-signature (multisig) authorization system that requires multiple authorized signatures for high-value payouts, significantly reducing the risk of unauthorized or fraudulent withdrawals.

## 🎯 Problem Solved

**Issue**: High-value payouts are a high risk without proper authorization controls.

**Solution**: M-of-N authorization scheme where withdrawals exceeding a configurable threshold remain pending until the required number of authorized signatures are collected.

## ✨ Features

- ✅ **Configurable Threshold**: Set custom amount limits per circle
- ✅ **M-of-N Authorization**: Flexible approval requirements (e.g., 2-of-3, 3-of-5)
- ✅ **Auto-Approval**: Automatic processing when threshold is met
- ✅ **Audit Trail**: Complete history of all approvals and rejections
- ✅ **Role-Based Access**: Organizers designate trusted approvers
- ✅ **Balance Protection**: Validates available balance before withdrawal
- ✅ **Duplicate Prevention**: One pending withdrawal per member
- ✅ **Security First**: Multiple authorization layers and atomic operations

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [MULTISIG_SUMMARY.md](./MULTISIG_SUMMARY.md) | Complete implementation summary |
| [MULTISIG_IMPLEMENTATION.md](./MULTISIG_IMPLEMENTATION.md) | Technical documentation and API reference |
| [MULTISIG_QUICKSTART.md](./MULTISIG_QUICKSTART.md) | Quick start guide with examples |
| [MULTISIG_CHECKLIST.md](./MULTISIG_CHECKLIST.md) | Implementation and deployment checklist |

## 🚀 Quick Start

### 1. Setup

```bash
# Linux/Mac
chmod +x scripts/setup-multisig.sh
./scripts/setup-multisig.sh

# Windows PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup-multisig.ps1
```

### 2. Configure Multisig

```typescript
// Enable multisig for a circle
await fetch(`/api/circles/${circleId}/multisig`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    multisigEnabled: true,
    multisigThreshold: 1000000000, // 100 XLM
    requiredApprovals: 2,
    approvers: [userId1, userId2, userId3]
  })
});
```

### 3. Request Withdrawal

```typescript
// Request high-value withdrawal
await fetch(`/api/circles/${circleId}/withdraw`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000000000, // 500 XLM
    reason: 'Emergency expense'
  })
});
```

### 4. Approve Withdrawal

```typescript
// Approver votes on withdrawal
await fetch(`/api/circles/${circleId}/withdraw/${withdrawalId}/approve`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${approverToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    approved: true,
    comment: 'Verified and approved'
  })
});
```

## 🏗️ Architecture

### Database Schema

```
Circle
├── multisigEnabled: boolean
├── multisigThreshold: number
├── requiredApprovals: number
└── approvers: string[] (JSON)

Withdrawal
├── amount: number
├── status: enum
└── approvals: WithdrawalApproval[]

WithdrawalApproval
├── withdrawalId: string
├── approverId: string
├── approved: boolean
└── comment: string?
```

### API Endpoints

```
POST   /api/circles/[id]/withdraw
GET    /api/circles/[id]/withdraw
POST   /api/circles/[id]/withdraw/[withdrawalId]/approve
GET    /api/circles/[id]/multisig
PUT    /api/circles/[id]/multisig
```

### Components

```
MultisigConfig.tsx       - Configure multisig settings
WithdrawalManager.tsx    - Manage withdrawals and approvals
```

## 🔒 Security Features

1. **Authorization Checks**: Multiple layers at every endpoint
2. **Balance Validation**: Prevents overdrafts
3. **Duplicate Prevention**: One pending withdrawal per member
4. **One Vote Per Approver**: Prevents vote manipulation
5. **Atomic Operations**: Race condition protection
6. **Audit Trail**: Complete history of all actions
7. **Withdrawal Penalty**: 10% penalty discourages abuse

## 📊 Example Configurations

### Small Circle (5 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 500000000,
  "requiredApprovals": 2,
  "approvers": ["organizer", "member1", "member2"]
}
```

### Medium Circle (15 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 1000000000,
  "requiredApprovals": 3,
  "approvers": ["organizer", "m1", "m2", "m3", "m4"]
}
```

### Large Circle (30 members)
```json
{
  "multisigEnabled": true,
  "multisigThreshold": 2000000000,
  "requiredApprovals": 4,
  "approvers": ["organizer", "m1", "m2", "m3", "m4", "m5", "m6"]
}
```

## 🧪 Testing

```bash
# Run test suite
npm test __tests__/api/multisig.test.ts

# Run all tests
npm test
```

## 📈 Workflow

### High-Value Withdrawal (Above Threshold)

```
Member Request → PENDING → Approver 1 ✓ → PENDING (1/2)
                         → Approver 2 ✓ → APPROVED (2/2)
                         → Auto-Approved → COMPLETED
```

### Low-Value Withdrawal (Below Threshold)

```
Member Request → APPROVED → COMPLETED
```

## 🛠️ Tech Stack

- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Frontend**: React, TypeScript, Tailwind CSS
- **Validation**: Zod
- **Testing**: Jest

## 📦 Files Structure

```
prisma/
├── schema.prisma                          # Updated schema
└── migrations/add_multisig_support/       # Migration SQL

lib/
├── services/multisig.ts                   # Business logic
└── validations/withdrawal.ts              # Validation schemas

app/api/circles/[id]/
├── withdraw/route.ts                      # Withdrawal API
├── withdraw/[withdrawalId]/approve/       # Approval API
└── multisig/route.ts                      # Config API

app/circles/[id]/components/
├── MultisigConfig.tsx                     # Config UI
└── WithdrawalManager.tsx                  # Withdrawal UI

__tests__/api/
└── multisig.test.ts                       # Test suite

scripts/
├── setup-multisig.sh                      # Setup (Linux/Mac)
└── setup-multisig.ps1                     # Setup (Windows)
```

## 🎯 Success Criteria

✅ Withdrawals above threshold require multisig  
✅ M-of-N authorization scheme implemented  
✅ Payouts remain pending until signatures collected  
✅ Complete audit trail maintained  
✅ Secure and tested implementation  
✅ User-friendly UI components  

## 🚦 Status

**Implementation**: ✅ Complete  
**Testing**: ✅ Complete  
**Documentation**: ✅ Complete  
**Ready for**: Staging Deployment  

## 🤝 Contributing

1. Review implementation documentation
2. Run tests to ensure everything works
3. Test on staging environment
4. Provide feedback and suggestions

## 📞 Support

For issues or questions:
1. Check [MULTISIG_IMPLEMENTATION.md](./MULTISIG_IMPLEMENTATION.md) for detailed docs
2. Review [MULTISIG_QUICKSTART.md](./MULTISIG_QUICKSTART.md) for examples
3. Check test files for usage patterns
4. Contact development team

## 📝 License

Part of the Decentralized Ajo project.

---

**Built with ❤️ for secure, transparent, and community-driven savings circles**
