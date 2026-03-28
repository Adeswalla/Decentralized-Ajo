# Transaction Flow Documentation

This document explains how to handle Stellar/Soroban transactions in the application, bridging the gap between wallet connection and on-chain actions.

## Overview

The transaction flow consists of three main stages:
1. **Building** - Construct the transaction XDR (typically on backend)
2. **Signing** - User approves transaction in their wallet (Freighter)
3. **Submitting & Polling** - Broadcast to network and wait for confirmation

## Core Components

### 1. Enhanced Wallet Context (`lib/wallet-context.tsx`)

The wallet context now provides two methods for transaction handling:

#### `signTransaction(xdr: string): Promise<string>`
Signs a transaction XDR and returns the signed XDR.

```typescript
const { signTransaction } = useWallet();
const signedXdr = await signTransaction(unsignedXdr);
```

#### `signAndSubmit(xdr: string, options?): Promise<SignAndSubmitResult>`
Complete transaction flow: signs, submits, and polls for confirmation.

```typescript
const { signAndSubmit } = useWallet();
const result = await signAndSubmit(xdr, {
  pollingTimeout: 60000,  // 60 seconds
  pollingInterval: 2000,  // 2 seconds
});

console.log(result.hash);    // Transaction hash
console.log(result.status);  // 'SUCCESS' | 'FAILED' | 'PENDING'
```

### 2. Transaction Submit Hook (`hooks/use-transaction-submit.ts`)

A React hook that provides transaction state management and automatic toast notifications.

```typescript
const { submitTransaction, isSubmitting, status, hash, error } = useTransactionSubmit({
  onSuccess: async (hash) => {
    // Called when transaction is confirmed
    console.log('Transaction confirmed:', hash);
  },
  onError: (error) => {
    // Called on any error
    console.error('Transaction failed:', error);
  },
  pollingTimeout: 60000,   // Optional: default 60s
  pollingInterval: 2000,   // Optional: default 2s
});

// Submit a transaction
await submitTransaction(xdr);
```

#### Transaction States
- `idle` - No transaction in progress
- `building` - Constructing transaction (handled by your code)
- `signing` - Waiting for user to approve in wallet
- `submitting` - Broadcasting to Stellar network
- `polling` - Waiting for network confirmation
- `success` - Transaction confirmed
- `error` - Transaction failed

#### Automatic Toast Notifications
The hook automatically shows toast notifications for each stage:
- 🔐 Signing Transaction
- 📤 Submitting Transaction
- ⏳ Confirming Transaction
- ✅ Transaction Confirmed
- ❌ Transaction Failed (with specific error messages)

## Usage Examples

### Example 1: Using the Hook (Recommended)

```typescript
'use client';

import { useTransactionSubmit } from '@/hooks/use-transaction-submit';
import { useWallet } from '@/lib/wallet-context';

export function ContributeButton({ circleId, amount }) {
  const { isConnected } = useWallet();
  
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

      // 2. Submit (sign + submit + poll)
      await submitTransaction(xdr);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button onClick={handleContribute} disabled={!isConnected || isSubmitting}>
      {status === 'signing' && 'Waiting for signature...'}
      {status === 'submitting' && 'Submitting...'}
      {status === 'polling' && 'Confirming...'}
      {!isSubmitting && 'Contribute'}
    </button>
  );
}
```

### Example 2: Using Wallet Context Directly

```typescript
'use client';

import { useWallet } from '@/lib/wallet-context';
import { useToast } from '@/hooks/use-toast';

export function DirectExample() {
  const { signAndSubmit, isConnected } = useWallet();
  const { toast } = useToast();

  const handleTransaction = async () => {
    try {
      // Build transaction
      const response = await fetch('/api/build-tx', {
        method: 'POST',
        body: JSON.stringify({ /* params */ }),
      });
      const { xdr } = await response.json();

      // Sign and submit
      const result = await signAndSubmit(xdr);

      if (result.status === 'SUCCESS') {
        toast({ title: 'Success!', description: `Hash: ${result.hash}` });
      }
    } catch (err) {
      toast({ 
        title: 'Failed', 
        description: err.message, 
        variant: 'destructive' 
      });
    }
  };

  return <button onClick={handleTransaction}>Submit</button>;
}
```

### Example 3: Manual Control

```typescript
'use client';

import { useWallet } from '@/lib/wallet-context';
import { getSorobanClient } from '@/lib/stellar-config';
import * as StellarSdk from '@stellar/stellar-sdk';

export function ManualExample() {
  const { signTransaction } = useWallet();

  const handleTransaction = async () => {
    try {
      // 1. Build transaction
      const { xdr } = await fetch('/api/build-tx').then(r => r.json());

      // 2. Sign
      const signedXdr = await signTransaction(xdr);

      // 3. Submit manually
      const server = getSorobanClient();
      const tx = new StellarSdk.Transaction(signedXdr, networkPassphrase);
      const response = await server.sendTransaction(tx);

      // 4. Poll manually
      // ... your custom polling logic
    } catch (err) {
      console.error(err);
    }
  };

  return <button onClick={handleTransaction}>Manual Flow</button>;
}
```

## Error Handling

The system handles common errors automatically:

### User Cancellation
```
Error: User declined access
Error: User canceled
```
Shows: "🚫 Transaction Canceled - You canceled the transaction in your wallet."

### Timeout
```
Error: Transaction polling timeout
```
Shows: "⏱️ Transaction Timeout - Transaction took too long to confirm. It may still succeed."

### Insufficient Balance
```
Error: insufficient balance
```
Shows: "💰 Insufficient Balance - You do not have enough funds for this transaction."

### Generic Errors
All other errors show the actual error message from the network.

## Backend Integration

Your backend should provide an endpoint to build transaction XDRs:

```typescript
// app/api/circles/[id]/build-contribution-tx/route.ts
export async function POST(request: NextRequest) {
  const { amount } = await request.json();
  
  // Build Soroban transaction
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('contribute', ...params))
    .setTimeout(180)
    .build();

  return NextResponse.json({ 
    xdr: transaction.toXDR() 
  });
}
```

## Testing Checklist

- [ ] Successful transaction updates on-chain (testnet)
- [ ] UI shows correct status during each stage
- [ ] Toast notifications appear for all stages
- [ ] User cancellation is handled gracefully
- [ ] UI resets correctly after cancellation
- [ ] Timeout handling works (set short timeout to test)
- [ ] Database updates after on-chain confirmation
- [ ] Error messages are user-friendly
- [ ] Multiple rapid clicks don't cause issues
- [ ] Wallet disconnection during transaction is handled

## Configuration

### Polling Settings
Adjust polling behavior in the hook or context:

```typescript
const { submitTransaction } = useTransactionSubmit({
  pollingTimeout: 90000,   // 90 seconds
  pollingInterval: 3000,   // 3 seconds
});
```

### Network Configuration
Update in `lib/stellar-config.ts`:

```typescript
export const STELLAR_CONFIG = {
  network: 'testnet',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
```

## Best Practices

1. **Always build transactions on the backend** - Never expose private keys or sensitive logic
2. **Use the hook for UI components** - It provides automatic state management and feedback
3. **Update database after confirmation** - Wait for on-chain success before updating your DB
4. **Handle all error cases** - User cancellation, timeouts, and network errors
5. **Provide clear feedback** - Users should always know what's happening
6. **Test on testnet first** - Always verify transactions work before mainnet deployment

## Troubleshooting

### Transaction not confirming
- Check Stellar testnet status
- Verify contract address is correct
- Ensure sufficient XLM balance for fees
- Increase polling timeout

### "Wallet not connected" error
- Ensure Freighter extension is installed
- Check wallet is unlocked
- Verify network matches (testnet vs mainnet)

### "Transaction failed" with no details
- Check browser console for full error
- Verify transaction XDR is valid
- Check contract function parameters
- Ensure account has necessary trustlines

## Additional Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Freighter Wallet API](https://docs.freighter.app/)
