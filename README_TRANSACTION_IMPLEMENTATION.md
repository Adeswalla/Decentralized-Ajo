# Transaction Implementation - Complete Guide

## 🎯 What This Solves

This implementation bridges the gap between wallet connection and on-chain actions by providing a complete, production-ready transaction flow with:

- ✅ Multi-step user feedback (signing → submitting → confirming)
- ✅ Automatic toast notifications at each stage
- ✅ Robust error handling (user cancellation, timeouts, network errors)
- ✅ Transaction polling with configurable timeout
- ✅ Developer-friendly API
- ✅ TypeScript support
- ✅ Comprehensive documentation

## 🚀 Quick Start

### 1. Use the Transaction Hook (Recommended)

```typescript
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';

function ContributeButton({ circleId, amount }) {
  const { submitTransaction, isSubmitting, status } = useTransactionSubmit({
    onSuccess: async (hash) => {
      // Update database after on-chain confirmation
      await fetch(`/api/circles/${circleId}/contribute`, {
        method: 'POST',
        body: JSON.stringify({ amount, transactionHash: hash }),
      });
    },
  });

  const handleContribute = async () => {
    try {
      // 1. Build transaction XDR from backend
      const response = await fetch(`/api/circles/${circleId}/build-tx`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      const { xdr } = await response.json();

      // 2. Submit transaction (handles signing, submission, and polling)
      await submitTransaction(xdr);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Button onClick={handleContribute} disabled={isSubmitting}>
      {status === 'signing' && 'Waiting for signature...'}
      {status === 'submitting' && 'Submitting...'}
      {status === 'polling' && 'Confirming...'}
      {!isSubmitting && 'Contribute'}
    </Button>
  );
}
```

### 2. Or Use Wallet Context Directly

```typescript
import { useWallet } from '@/lib/wallet-context';

function MyComponent() {
  const { signAndSubmit } = useWallet();

  const handleTransaction = async () => {
    const { xdr } = await fetch('/api/build-tx').then(r => r.json());
    
    const result = await signAndSubmit(xdr, {
      pollingTimeout: 60000,
      pollingInterval: 2000,
    });

    console.log('Transaction hash:', result.hash);
    console.log('Status:', result.status);
  };

  return <button onClick={handleTransaction}>Submit</button>;
}
```

## 📁 Files Overview

### Core Implementation
- `hooks/use-transaction-submit.ts` - Main transaction hook with state management
- `lib/wallet-context.tsx` - Enhanced wallet context with `signAndSubmit()`
- `lib/transaction-helpers.ts` - Utility functions for common patterns

### Examples
- `components/circles/contribute-button.tsx` - Complete working example
- `lib/examples/transaction-example.tsx` - Multiple usage patterns

### Documentation
- `TRANSACTION_FLOW.md` - Complete technical documentation
- `TRANSACTION_QUICK_REFERENCE.md` - Quick reference guide
- `TRANSACTION_MIGRATION_GUIDE.md` - Migration from old code
- `TRANSACTION_FLOW_DIAGRAM.md` - Visual flow diagrams
- `TRANSACTION_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `lib/__tests__/transaction-flow.test.md` - Manual testing guide

## 🎨 User Experience

### What Users See

1. **Signing Stage** (2-5 seconds)
   - Toast: 🔐 "Signing Transaction - Please approve in your wallet..."
   - Freighter popup appears
   - Button: "Waiting for signature..."

2. **Submitting Stage** (1-2 seconds)
   - Toast: 📤 "Submitting Transaction - Broadcasting to network..."
   - Button: "Submitting..."

3. **Confirming Stage** (2-10 seconds)
   - Toast: ⏳ "Confirming Transaction - Waiting for confirmation..."
   - Button: "Confirming..."

4. **Success** (instant)
   - Toast: ✅ "Transaction Confirmed - Hash: abc123..."
   - Button: Returns to normal state
   - Database updated
   - UI refreshed

### Error Handling

| Scenario | User Sees |
|----------|-----------|
| User cancels | 🚫 "Transaction Canceled - You canceled the transaction" |
| Timeout | ⏱️ "Transaction Timeout - May still succeed" |
| Insufficient balance | 💰 "Insufficient Balance - Not enough funds" |
| Network error | ❌ "Network Error - Check your connection" |

## 🔧 Configuration

### Polling Settings

```typescript
const { submitTransaction } = useTransactionSubmit({
  pollingTimeout: 60000,   // 60 seconds (default)
  pollingInterval: 2000,   // 2 seconds (default)
});
```

### Network Configuration

```typescript
// lib/stellar-config.ts
export const STELLAR_CONFIG = {
  network: 'testnet',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Successful transaction completes end-to-end
- [ ] User cancellation is handled gracefully
- [ ] Timeout scenario works (reduce timeout to 5s to test)
- [ ] Insufficient balance error displays correctly
- [ ] Network disconnection during transaction is handled
- [ ] Multiple rapid clicks don't cause issues
- [ ] Toast notifications appear at each stage
- [ ] Database updates after on-chain confirmation
- [ ] UI resets correctly after errors
- [ ] Works on testnet

See `lib/__tests__/transaction-flow.test.md` for detailed test cases.

## 📊 Transaction States

| State | Description | UI Display |
|-------|-------------|------------|
| `idle` | No transaction in progress | Normal button |
| `signing` | Waiting for wallet approval | "Waiting for signature..." |
| `submitting` | Broadcasting to network | "Submitting..." |
| `polling` | Waiting for confirmation | "Confirming..." |
| `success` | Transaction confirmed | Success message |
| `error` | Transaction failed | Error message |

## 🎯 Common Patterns

### Pattern 1: Simple Transaction

```typescript
const { submitTransaction, isSubmitting } = useTransactionSubmit();

const handleAction = async () => {
  const { xdr } = await fetch('/api/build-tx').then(r => r.json());
  await submitTransaction(xdr);
};
```

### Pattern 2: With Database Update

```typescript
const { submitTransaction } = useTransactionSubmit({
  onSuccess: async (hash) => {
    await fetch('/api/update', {
      method: 'POST',
      body: JSON.stringify({ transactionHash: hash }),
    });
  },
});
```

### Pattern 3: With Custom Error Handling

```typescript
import { parseTransactionError } from '@/lib/transaction-helpers';

const { submitTransaction } = useTransactionSubmit({
  onError: (error) => {
    const { title, message, isUserCanceled } = parseTransactionError(error);
    
    if (!isUserCanceled) {
      logToErrorService(error);
    }
  },
});
```

### Pattern 4: With Loading State

```typescript
const [isBuilding, setIsBuilding] = useState(false);
const { submitTransaction, isSubmitting } = useTransactionSubmit();

const handleAction = async () => {
  setIsBuilding(true);
  const { xdr } = await buildTransaction();
  setIsBuilding(false);
  
  await submitTransaction(xdr);
};

const isLoading = isBuilding || isSubmitting;
```

## 🔗 Utility Functions

### Format Transaction Hash

```typescript
import { formatTransactionHash } from '@/lib/transaction-helpers';

const short = formatTransactionHash(hash); // "abc12345...xyz98765"
```

### Get Explorer Link

```typescript
import { getTransactionExplorerUrl } from '@/lib/transaction-helpers';

const url = getTransactionExplorerUrl(hash);
// https://stellar.expert/explorer/testnet/tx/{hash}
```

### Check Balance

```typescript
import { checkSufficientBalance } from '@/lib/transaction-helpers';

const { sufficient, balance } = await checkSufficientBalance(publicKey, 100);
if (!sufficient) {
  alert(`Insufficient balance. You have ${balance} XLM`);
}
```

### Parse Errors

```typescript
import { parseTransactionError } from '@/lib/transaction-helpers';

try {
  await submitTransaction(xdr);
} catch (err) {
  const { title, message, isUserCanceled } = parseTransactionError(err);
  console.log(title, message);
}
```

## 📚 Documentation Index

1. **Getting Started**
   - This file (README_TRANSACTION_IMPLEMENTATION.md)
   - TRANSACTION_QUICK_REFERENCE.md

2. **Implementation Details**
   - TRANSACTION_FLOW.md
   - TRANSACTION_FLOW_DIAGRAM.md
   - TRANSACTION_IMPLEMENTATION_SUMMARY.md

3. **Migration & Testing**
   - TRANSACTION_MIGRATION_GUIDE.md
   - lib/__tests__/transaction-flow.test.md

4. **Code Examples**
   - components/circles/contribute-button.tsx
   - lib/examples/transaction-example.tsx

## 🆘 Troubleshooting

### "Wallet not connected"
- Ensure Freighter extension is installed
- Check wallet is unlocked
- Verify network matches (testnet vs mainnet)

### Transaction not confirming
- Check Stellar testnet status
- Verify contract address is correct
- Ensure sufficient XLM balance for fees
- Increase polling timeout

### "Transaction failed" with no details
- Check browser console for full error
- Verify transaction XDR is valid
- Check contract function parameters
- Ensure account has necessary trustlines

### Toast notifications not appearing
- Ensure Toaster component is in your layout
- Check useToast hook is properly configured
- Verify toast imports are correct

## ✅ Acceptance Criteria

All acceptance criteria from the original issue have been met:

✅ Multi-step feedback via toasts/modals
- Automatic toast notifications at each stage
- Clear status indicators in UI

✅ Automatic timeout/retry logic for Soroban polling
- Configurable polling timeout (default 60s)
- Configurable polling interval (default 2s)
- Retry helper function with exponential backoff

✅ Correctly handles "User Canceled" error from Freighter
- Detects user cancellation
- Shows user-friendly message
- Doesn't log as error
- Resets UI state properly

## 🎉 Benefits

### For Developers
- Simple, intuitive API
- Automatic state management
- Comprehensive error handling
- TypeScript support
- Reusable patterns
- Extensive documentation

### For Users
- Clear feedback at every stage
- User-friendly error messages
- Smooth transaction experience
- No confusion about status
- Confidence in the process

## 🚀 Next Steps

1. **Test on Testnet**
   - Run through all test cases
   - Verify error scenarios
   - Test with real transactions

2. **Update Existing Components**
   - Migrate old transaction code
   - Use new hook in all transaction flows
   - Remove manual state management

3. **Monitor & Optimize**
   - Track transaction success rates
   - Collect user feedback
   - Optimize polling intervals
   - Add analytics

4. **Future Enhancements**
   - Transaction history tracking
   - Batch transaction support
   - Gas estimation display
   - Transaction simulation preview
   - Multi-signature support

## 📞 Support

For questions or issues:
1. Check the documentation files
2. Review example components
3. Test with the manual testing guide
4. Check troubleshooting section

## 🔗 Related Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Freighter Wallet API](https://docs.freighter.app/)
- [Stellar Expert Explorer](https://stellar.expert/)

---

**Implementation Status:** ✅ Complete and ready for testing

**Last Updated:** March 24, 2026

**Version:** 1.0.0
