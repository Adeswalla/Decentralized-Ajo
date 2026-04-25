# Transaction Flow - Quick Reference

## 🚀 Quick Start

### Option 1: Use the Hook (Recommended)

```typescript
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';

const { submitTransaction, isSubmitting, status } = useTransactionSubmit({
  onSuccess: async (hash) => {
    // Update your database
  }
});

// In your handler
const { xdr } = await fetch('/api/build-tx', { ... }).then(r => r.json());
await submitTransaction(xdr);
```

### Option 2: Use Wallet Context

```typescript
import { useWallet } from '@/lib/wallet-context';

const { signAndSubmit } = useWallet();

const result = await signAndSubmit(xdr);
console.log(result.hash);
```

## 📊 Transaction States

| State | Description | User Sees |
|-------|-------------|-----------|
| `idle` | No transaction | Normal button |
| `signing` | Waiting for wallet approval | "Waiting for signature..." |
| `submitting` | Broadcasting to network | "Submitting..." |
| `polling` | Waiting for confirmation | "Confirming..." |
| `success` | Transaction confirmed | Success message |
| `error` | Transaction failed | Error message |

## 🎯 Common Patterns

### Pattern 1: Contribute to Circle

```typescript
const handleContribute = async () => {
  const { xdr } = await fetch(`/api/circles/${id}/build-tx`, {
    method: 'POST',
    body: JSON.stringify({ amount: 100 })
  }).then(r => r.json());
  
  await submitTransaction(xdr);
};
```

### Pattern 2: With Loading State

```typescript
const [isBuilding, setIsBuilding] = useState(false);

const handleAction = async () => {
  setIsBuilding(true);
  const { xdr } = await buildTransaction();
  setIsBuilding(false);
  
  await submitTransaction(xdr);
};

const isLoading = isBuilding || isSubmitting;
```

### Pattern 3: With Error Handling

```typescript
const { submitTransaction } = useTransactionSubmit({
  onSuccess: async (hash) => {
    await updateDatabase(hash);
    router.push('/success');
  },
  onError: (error) => {
    logError(error);
    // Custom error handling
  }
});
```

## 🎨 UI Components

### Button with Status

```typescript
<Button 
  disabled={!isConnected} 
  isLoading={isSubmitting}
>
  {status === 'signing' && 'Waiting for signature...'}
  {status === 'submitting' && 'Submitting...'}
  {status === 'polling' && 'Confirming...'}
  {!isSubmitting && 'Submit Transaction'}
</Button>
```

### Status Badge

```typescript
import { getTransactionStatusEmoji } from '@/lib/transaction-helpers';

<Badge>
  {getTransactionStatusEmoji(status)} {status}
</Badge>
```

## 🔧 Configuration

### Custom Polling

```typescript
const { submitTransaction } = useTransactionSubmit({
  pollingTimeout: 90000,   // 90 seconds
  pollingInterval: 3000,   // 3 seconds
});
```

### Network Config

```typescript
// lib/stellar-config.ts
export const STELLAR_CONFIG = {
  network: 'testnet',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
```

## ❌ Error Handling

### Automatic Error Messages

| Error Type | Toast Title | Description |
|------------|-------------|-------------|
| User canceled | 🚫 Transaction Canceled | You canceled the transaction |
| Timeout | ⏱️ Transaction Timeout | Took too long to confirm |
| Insufficient balance | 💰 Insufficient Balance | Not enough funds |
| Generic | ❌ Transaction Failed | Error message |

### Custom Error Handling

```typescript
import { parseTransactionError } from '@/lib/transaction-helpers';

try {
  await submitTransaction(xdr);
} catch (err) {
  const { title, message, isUserCanceled } = parseTransactionError(err);
  
  if (!isUserCanceled) {
    // Log to error tracking service
    logError(err);
  }
}
```

## 🔗 Utilities

### Format Hash

```typescript
import { formatTransactionHash } from '@/lib/transaction-helpers';

const short = formatTransactionHash(hash); // "abc12345...xyz98765"
```

### Explorer Link

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

## 🧪 Testing

### Test User Cancellation

```typescript
// User clicks "Reject" in Freighter
// Expected: Toast shows "Transaction Canceled"
// Button returns to enabled state
```

### Test Timeout

```typescript
const { submitTransaction } = useTransactionSubmit({
  pollingTimeout: 5000, // 5 seconds for testing
});
```

### Test Success Flow

```typescript
// 1. Click button
// 2. Approve in Freighter
// 3. See "Signing" → "Submitting" → "Confirming" → "Success"
// 4. Database updated
// 5. UI refreshed
```

## 📝 Checklist

Before deploying:

- [ ] Tested successful transaction
- [ ] Tested user cancellation
- [ ] Tested timeout scenario
- [ ] Tested insufficient balance
- [ ] Database updates after confirmation
- [ ] UI shows all status states
- [ ] Toast notifications work
- [ ] Error messages are clear
- [ ] Button disabled during transaction
- [ ] Works on testnet
- [ ] Ready for mainnet

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Wallet not connected" | Check Freighter is installed and unlocked |
| Transaction not confirming | Increase polling timeout |
| "Transaction failed" | Check console for details, verify XDR |
| No toast notifications | Ensure Toaster component is in layout |
| Button stays disabled | Check isSubmitting state resets on error |

## 📚 Full Documentation

See [TRANSACTION_FLOW.md](./TRANSACTION_FLOW.md) for complete documentation.

## 🔗 Related Files

- `lib/wallet-context.tsx` - Wallet connection & signing
- `hooks/use-transaction-submit.ts` - Transaction hook
- `lib/transaction-helpers.ts` - Utility functions
- `lib/stellar-config.ts` - Network configuration
- `components/circles/contribute-button.tsx` - Example component
