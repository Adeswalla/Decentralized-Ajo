# Migration Guide: Updating to New Transaction Flow

This guide helps you migrate existing transaction code to use the new enhanced wallet context and transaction submission hook.

## Overview of Changes

### What's New
- ✅ `useTransactionSubmit` hook for automatic state management
- ✅ `signAndSubmit` method in wallet context for complete flow
- ✅ Automatic toast notifications for all transaction stages
- ✅ Built-in error handling for common scenarios
- ✅ Transaction polling with configurable timeout
- ✅ Helper utilities for common patterns

### What's Unchanged
- ✅ `signTransaction` method still available for manual control
- ✅ Wallet connection flow remains the same
- ✅ Backend transaction building unchanged

## Migration Scenarios

### Scenario 1: Basic Transaction Signing

#### Before
```typescript
import { useWallet } from '@/lib/wallet-context';

function MyComponent() {
  const { signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const handleTransaction = async () => {
    setIsLoading(true);
    try {
      const { xdr } = await fetch('/api/build-tx').then(r => r.json());
      const signedXdr = await signTransaction(xdr);
      
      // Manual submission
      const server = getSorobanClient();
      const tx = new Transaction(signedXdr, networkPassphrase);
      const response = await server.sendTransaction(tx);
      
      // Manual polling
      let status = 'PENDING';
      while (status === 'PENDING') {
        const result = await server.getTransaction(response.hash);
        status = result.status;
        await new Promise(r => setTimeout(r, 2000));
      }
      
      alert('Success!');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return <button onClick={handleTransaction}>Submit</button>;
}
```

#### After (Option 1: Using Hook)
```typescript
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';

function MyComponent() {
  const { submitTransaction, isSubmitting } = useTransactionSubmit({
    onSuccess: async (hash) => {
      console.log('Success:', hash);
    }
  });

  const handleTransaction = async () => {
    try {
      const { xdr } = await fetch('/api/build-tx').then(r => r.json());
      await submitTransaction(xdr);
    } catch (err) {
      // Error already handled with toast
      console.error(err);
    }
  };

  return (
    <button onClick={handleTransaction} disabled={isSubmitting}>
      Submit
    </button>
  );
}
```

#### After (Option 2: Using Context)
```typescript
import { useWallet } from '@/lib/wallet-context';

function MyComponent() {
  const { signAndSubmit } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const handleTransaction = async () => {
    setIsLoading(true);
    try {
      const { xdr } = await fetch('/api/build-tx').then(r => r.json());
      const result = await signAndSubmit(xdr);
      
      if (result.status === 'SUCCESS') {
        alert('Success: ' + result.hash);
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return <button onClick={handleTransaction}>Submit</button>;
}
```

### Scenario 2: Transaction with Custom Error Handling

#### Before
```typescript
const handleTransaction = async () => {
  try {
    const signedXdr = await signTransaction(xdr);
    // ... submission logic
  } catch (err) {
    if (err.message.includes('User declined')) {
      toast({ title: 'Canceled', variant: 'destructive' });
    } else if (err.message.includes('insufficient')) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
    } else {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }
};
```

#### After
```typescript
import { parseTransactionError } from '@/lib/transaction-helpers';

const { submitTransaction } = useTransactionSubmit({
  onError: (error) => {
    const { title, message, isUserCanceled } = parseTransactionError(error);
    
    // Custom handling for specific cases
    if (isUserCanceled) {
      // User canceled - maybe don't log this
      return;
    }
    
    // Log other errors to your service
    logToErrorService(error);
  }
});
```

### Scenario 3: Transaction with Loading States

#### Before
```typescript
const [isSigning, setIsSigning] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [isPolling, setIsPolling] = useState(false);

const handleTransaction = async () => {
  setIsSigning(true);
  const signedXdr = await signTransaction(xdr);
  setIsSigning(false);
  
  setIsSubmitting(true);
  const response = await server.sendTransaction(tx);
  setIsSubmitting(false);
  
  setIsPolling(true);
  // ... polling logic
  setIsPolling(false);
};

return (
  <button disabled={isSigning || isSubmitting || isPolling}>
    {isSigning && 'Signing...'}
    {isSubmitting && 'Submitting...'}
    {isPolling && 'Confirming...'}
    {!isSigning && !isSubmitting && !isPolling && 'Submit'}
  </button>
);
```

#### After
```typescript
const { submitTransaction, isSubmitting, status } = useTransactionSubmit();

const handleTransaction = async () => {
  await submitTransaction(xdr);
};

return (
  <button disabled={isSubmitting}>
    {status === 'signing' && 'Signing...'}
    {status === 'submitting' && 'Submitting...'}
    {status === 'polling' && 'Confirming...'}
    {status === 'idle' && 'Submit'}
  </button>
);
```

### Scenario 4: Transaction with Database Update

#### Before
```typescript
const handleContribute = async () => {
  try {
    const { xdr } = await fetch('/api/build-tx').then(r => r.json());
    const signedXdr = await signTransaction(xdr);
    
    // Submit and poll
    const hash = await submitAndPoll(signedXdr);
    
    // Update database
    await fetch('/api/circles/123/contribute', {
      method: 'POST',
      body: JSON.stringify({ amount: 100, hash })
    });
    
    // Refresh UI
    mutate('/api/circles/123');
  } catch (err) {
    console.error(err);
  }
};
```

#### After
```typescript
const { submitTransaction } = useTransactionSubmit({
  onSuccess: async (hash) => {
    // Update database after on-chain confirmation
    await fetch('/api/circles/123/contribute', {
      method: 'POST',
      body: JSON.stringify({ amount: 100, hash })
    });
    
    // Refresh UI
    mutate('/api/circles/123');
  }
});

const handleContribute = async () => {
  try {
    const { xdr } = await fetch('/api/build-tx').then(r => r.json());
    await submitTransaction(xdr);
  } catch (err) {
    console.error(err);
  }
};
```

### Scenario 5: Multiple Transaction Types

#### Before
```typescript
const handleContribute = async () => {
  // ... contribute logic
};

const handleWithdraw = async () => {
  // ... withdraw logic (similar pattern)
};

const handleVote = async () => {
  // ... vote logic (similar pattern)
};
```

#### After
```typescript
// Create a reusable hook
function useCircleTransaction(circleId: string) {
  return useTransactionSubmit({
    onSuccess: async (hash) => {
      // Common success handling
      mutate(`/api/circles/${circleId}`);
    }
  });
}

// Use in component
const { submitTransaction, isSubmitting } = useCircleTransaction(circleId);

const handleContribute = async () => {
  const { xdr } = await fetch(`/api/circles/${circleId}/build-contribute`).then(r => r.json());
  await submitTransaction(xdr);
};

const handleWithdraw = async () => {
  const { xdr } = await fetch(`/api/circles/${circleId}/build-withdraw`).then(r => r.json());
  await submitTransaction(xdr);
};
```

## Step-by-Step Migration Process

### Step 1: Update Imports

```typescript
// Add new imports
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';
import { parseTransactionError } from '@/lib/transaction-helpers';
```

### Step 2: Replace Manual State Management

Remove:
```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Add:
```typescript
const { submitTransaction, isSubmitting, status, error } = useTransactionSubmit();
```

### Step 3: Simplify Transaction Handler

Remove manual signing, submission, and polling code. Replace with:
```typescript
await submitTransaction(xdr);
```

### Step 4: Update UI Components

Replace manual loading states with hook states:
```typescript
disabled={isSubmitting}
{status === 'signing' && 'Signing...'}
```

### Step 5: Move Success Logic to Callback

Move database updates and UI refreshes to `onSuccess` callback:
```typescript
const { submitTransaction } = useTransactionSubmit({
  onSuccess: async (hash) => {
    // Your success logic here
  }
});
```

### Step 6: Remove Manual Toast Notifications

The hook handles toast notifications automatically. Remove manual toast calls for transaction stages.

### Step 7: Test Thoroughly

- [ ] Test successful transaction
- [ ] Test user cancellation
- [ ] Test error scenarios
- [ ] Verify database updates
- [ ] Check UI state management

## Common Pitfalls

### Pitfall 1: Forgetting to Handle Building State

```typescript
// ❌ Bad: No loading state while building transaction
const handleTransaction = async () => {
  const { xdr } = await fetch('/api/build-tx').then(r => r.json());
  await submitTransaction(xdr);
};

// ✅ Good: Show loading during build
const [isBuilding, setIsBuilding] = useState(false);

const handleTransaction = async () => {
  setIsBuilding(true);
  const { xdr } = await fetch('/api/build-tx').then(r => r.json());
  setIsBuilding(false);
  await submitTransaction(xdr);
};

const isLoading = isBuilding || isSubmitting;
```

### Pitfall 2: Not Waiting for On-Chain Confirmation

```typescript
// ❌ Bad: Update database immediately after signing
const handleTransaction = async () => {
  await submitTransaction(xdr);
  await updateDatabase(); // Might fail if transaction fails
};

// ✅ Good: Update database in onSuccess callback
const { submitTransaction } = useTransactionSubmit({
  onSuccess: async (hash) => {
    await updateDatabase(hash);
  }
});
```

### Pitfall 3: Duplicate Error Handling

```typescript
// ❌ Bad: Hook already shows toast, this is redundant
const { submitTransaction } = useTransactionSubmit();

try {
  await submitTransaction(xdr);
} catch (err) {
  toast({ title: 'Error', description: err.message }); // Duplicate!
}

// ✅ Good: Let hook handle toast, use onError for custom logic
const { submitTransaction } = useTransactionSubmit({
  onError: (error) => {
    logToErrorService(error); // Custom logic only
  }
});
```

## Backward Compatibility

The old `signTransaction` method is still available if you need manual control:

```typescript
const { signTransaction } = useWallet();

// Still works for advanced use cases
const signedXdr = await signTransaction(xdr);
// ... your custom submission logic
```

## Testing Your Migration

Use this checklist to verify your migration:

- [ ] All transaction buttons work
- [ ] Loading states display correctly
- [ ] Toast notifications appear
- [ ] User cancellation is handled
- [ ] Database updates after confirmation
- [ ] Error messages are user-friendly
- [ ] UI resets after errors
- [ ] No console errors
- [ ] Works on testnet
- [ ] Performance is acceptable

## Getting Help

If you encounter issues during migration:

1. Check [TRANSACTION_FLOW.md](./TRANSACTION_FLOW.md) for detailed documentation
2. Review [TRANSACTION_QUICK_REFERENCE.md](./TRANSACTION_QUICK_REFERENCE.md) for patterns
3. Look at example components in `components/circles/contribute-button.tsx`
4. Check `lib/examples/transaction-example.tsx` for usage examples

## Rollback Plan

If you need to rollback:

1. The old `signTransaction` method still works
2. You can keep using manual submission and polling
3. New features are additive, not breaking changes
4. Gradually migrate one component at a time

## Next Steps

After migration:

1. Monitor transaction success rates
2. Collect user feedback on new UX
3. Optimize polling intervals based on network performance
4. Consider adding transaction history tracking
5. Implement retry logic for failed transactions
