'use client';

import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { useWallet } from '@/lib/wallet-context';
import * as StellarSdk from '@stellar/stellar-sdk';
import { getSorobanClient, STELLAR_CONFIG } from '@/lib/stellar-config';

export type TransactionStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'polling' | 'success' | 'error';

interface TransactionState {
  status: TransactionStatus;
  hash?: string;
  error?: string;
  isSubmitting: boolean;
}

interface UseTransactionSubmitOptions {
  onSuccess?: (hash: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  pollingTimeout?: number; // milliseconds
  pollingInterval?: number; // milliseconds
}

export function useTransactionSubmit(options: UseTransactionSubmitOptions = {}) {
  const {
    onSuccess,
    onError,
    pollingTimeout = 60000, // 60 seconds default
    pollingInterval = 2000, // 2 seconds default
  } = options;

  const { toast } = useToast();
  const { signTransaction, isConnected } = useWallet();

  const [state, setState] = useState<TransactionState>({
    status: 'idle',
    isSubmitting: false,
  });

  const pollTransactionStatus = useCallback(
    async (hash: string): Promise<any> => {
      const server = getSorobanClient();
      const startTime = Date.now();

      while (Date.now() - startTime < pollingTimeout) {
        try {
          const response = await server.getTransaction(hash);

          if (response.status === 'SUCCESS') {
            return response;
          }

          if (response.status === 'FAILED') {
            throw new Error(`Transaction failed: ${JSON.stringify(response)}`);
          }

          // If still pending, wait before polling again
          if (response.status === 'NOT_FOUND' || response.status === 'PENDING') {
            await new Promise((resolve) => setTimeout(resolve, pollingInterval));
            continue;
          }
        } catch (err) {
          // Continue polling on network errors
          if (Date.now() - startTime >= pollingTimeout) {
            throw new Error('Transaction polling timeout');
          }
          await new Promise((resolve) => setTimeout(resolve, pollingInterval));
        }
      }

      throw new Error('Transaction polling timeout');
    },
    [pollingTimeout, pollingInterval]
  );

  const submitTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      setState({ status: 'signing', isSubmitting: true });

      let toastId: string | undefined;

      try {
        // Step 1: Sign transaction
        toastId = toast({
          title: '🔐 Signing Transaction',
          description: 'Please approve the transaction in your wallet...',
        }).id;

        const signedXdr = await signTransaction(xdr);

        // Step 2: Submit transaction
        setState({ status: 'submitting', isSubmitting: true });
        toast({
          title: '📤 Submitting Transaction',
          description: 'Broadcasting to the Stellar network...',
        });

        const server = getSorobanClient();
        const transaction = new StellarSdk.Transaction(signedXdr, STELLAR_CONFIG.networkPassphrase);
        const sendResponse = await server.sendTransaction(transaction);

        if (sendResponse.status === 'ERROR') {
          throw new Error(`Transaction submission failed: ${sendResponse.errorResult?.toString()}`);
        }

        const hash = sendResponse.hash;
        setState({ status: 'polling', hash, isSubmitting: true });

        // Step 3: Poll for confirmation
        toast({
          title: '⏳ Confirming Transaction',
          description: 'Waiting for network confirmation...',
        });

        const finalResponse = await pollTransactionStatus(hash);

        // Step 4: Success
        setState({ status: 'success', hash, isSubmitting: false });
        toast({
          title: '✅ Transaction Confirmed',
          description: `Transaction successful! Hash: ${hash.substring(0, 8)}...`,
          variant: 'default',
        });

        if (onSuccess) {
          await onSuccess(hash);
        }

        return hash;
      } catch (err) {
        const error = err as Error;
        let errorMessage = error.message;
        let errorTitle = '❌ Transaction Failed';

        // Handle specific error cases
        if (errorMessage.includes('User declined') || errorMessage.includes('User canceled')) {
          errorTitle = '🚫 Transaction Canceled';
          errorMessage = 'You canceled the transaction in your wallet.';
        } else if (errorMessage.includes('timeout')) {
          errorTitle = '⏱️ Transaction Timeout';
          errorMessage = 'Transaction took too long to confirm. It may still succeed.';
        } else if (errorMessage.includes('insufficient')) {
          errorTitle = '💰 Insufficient Balance';
          errorMessage = 'You do not have enough funds for this transaction.';
        }

        setState({
          status: 'error',
          error: errorMessage,
          isSubmitting: false,
        });

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });

        if (onError) {
          onError(error);
        }

        throw error;
      }
    },
    [isConnected, signTransaction, toast, pollTransactionStatus, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', isSubmitting: false });
  }, []);

  return {
    submitTransaction,
    reset,
    ...state,
  };
}
