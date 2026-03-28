'use client';

/**
 * Example demonstrating different ways to handle Stellar transactions
 * with the enhanced wallet context and transaction submission hook.
 */

import { useWallet } from '@/lib/wallet-context';
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';
import { useToast } from '@/hooks/use-toast';

// Example 1: Using the useTransactionSubmit hook (Recommended)
export function ExampleWithHook() {
  const { isConnected } = useWallet();
  
  const { submitTransaction, isSubmitting, status, hash } = useTransactionSubmit({
    onSuccess: async (txHash) => {
      console.log('Transaction successful:', txHash);
      // Refresh your UI state, update database, etc.
    },
    onError: (error) => {
      console.error('Transaction failed:', error);
    },
    pollingTimeout: 60000, // 60 seconds
    pollingInterval: 2000, // 2 seconds
  });

  const handleTransaction = async () => {
    if (!isConnected) return;

    try {
      // 1. Build transaction XDR (from your API)
      const response = await fetch('/api/circles/123/build-contribution-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 }),
      });
      
      const { xdr } = await response.json();

      // 2. Submit transaction (handles signing, submission, and polling)
      const txHash = await submitTransaction(xdr);
      
      console.log('Final hash:', txHash);
    } catch (err) {
      // Error already handled by the hook with toast notifications
      console.error(err);
    }
  };

  return (
    <button onClick={handleTransaction} disabled={isSubmitting}>
      {status === 'signing' && 'Sign in wallet...'}
      {status === 'submitting' && 'Submitting...'}
      {status === 'polling' && 'Confirming...'}
      {status === 'success' && 'Success!'}
      {status === 'idle' && 'Submit Transaction'}
    </button>
  );
}

// Example 2: Using wallet context's signAndSubmit directly
export function ExampleWithContext() {
  const { signAndSubmit, isConnected } = useWallet();
  const { toast } = useToast();

  const handleTransaction = async () => {
    if (!isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Show initial toast
      toast({
        title: 'Building Transaction',
        description: 'Preparing your transaction...',
      });

      // 1. Build transaction XDR
      const response = await fetch('/api/circles/123/build-contribution-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 }),
      });
      
      const { xdr } = await response.json();

      // 2. Sign and submit (with automatic polling)
      const result = await signAndSubmit(xdr, {
        pollingTimeout: 60000,
        pollingInterval: 2000,
      });

      if (result.status === 'SUCCESS') {
        toast({
          title: 'Transaction Successful',
          description: `Hash: ${result.hash}`,
        });
        
        // Update your database
        await fetch('/api/circles/123/contribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: 100, 
            transactionHash: result.hash 
          }),
        });
      }
    } catch (err) {
      const error = err as Error;
      
      // Handle specific errors
      if (error.message.includes('User declined') || error.message.includes('User canceled')) {
        toast({
          title: 'Transaction Canceled',
          description: 'You canceled the transaction in your wallet',
          variant: 'destructive',
        });
      } else if (error.message.includes('timeout')) {
        toast({
          title: 'Transaction Timeout',
          description: 'Transaction took too long. It may still succeed.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Transaction Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <button onClick={handleTransaction}>
      Submit Transaction
    </button>
  );
}

// Example 3: Manual signing and submission (for advanced use cases)
export function ExampleManual() {
  const { signTransaction, isConnected } = useWallet();
  const { toast } = useToast();

  const handleTransaction = async () => {
    if (!isConnected) return;

    try {
      // 1. Build transaction
      const response = await fetch('/api/circles/123/build-contribution-tx', {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      });
      const { xdr } = await response.json();

      // 2. Sign only
      toast({ title: 'Signing', description: 'Please approve in wallet...' });
      const signedXdr = await signTransaction(xdr);

      // 3. You handle submission yourself
      toast({ title: 'Submitting', description: 'Broadcasting...' });
      // ... custom submission logic

    } catch (err) {
      console.error(err);
    }
  };

  return <button onClick={handleTransaction}>Manual Flow</button>;
}
