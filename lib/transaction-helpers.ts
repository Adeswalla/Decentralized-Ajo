/**
 * Transaction Helper Utilities
 * 
 * Common patterns and utilities for handling Stellar/Soroban transactions
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, getSorobanClient } from './stellar-config';

/**
 * Build a transaction XDR for contribution
 * This is typically done on the backend, but provided here as reference
 */
export async function buildContributionTransaction(
  sourcePublicKey: string,
  contractAddress: string,
  amount: number
): Promise<string> {
  const server = getSorobanClient();
  
  // Load source account
  const sourceAccount = await server.getAccount(sourcePublicKey);
  
  // Build contract call
  const contract = new StellarSdk.Contract(contractAddress);
  
  // Create transaction
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'contribute',
        // Add your contract parameters here
        StellarSdk.nativeToScVal(amount, { type: 'i128' })
      )
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

/**
 * Parse transaction error to user-friendly message
 */
export function parseTransactionError(error: Error): {
  title: string;
  message: string;
  isUserCanceled: boolean;
} {
  const errorMessage = error.message.toLowerCase();

  // User canceled
  if (errorMessage.includes('user declined') || errorMessage.includes('user canceled')) {
    return {
      title: 'Transaction Canceled',
      message: 'You canceled the transaction in your wallet.',
      isUserCanceled: true,
    };
  }

  // Timeout
  if (errorMessage.includes('timeout')) {
    return {
      title: 'Transaction Timeout',
      message: 'The transaction took too long to confirm. It may still succeed.',
      isUserCanceled: false,
    };
  }

  // Insufficient balance
  if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
    return {
      title: 'Insufficient Balance',
      message: 'You do not have enough funds for this transaction.',
      isUserCanceled: false,
    };
  }

  // Network error
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      title: 'Network Error',
      message: 'Unable to connect to the Stellar network. Please check your connection.',
      isUserCanceled: false,
    };
  }

  // Contract error
  if (errorMessage.includes('contract')) {
    return {
      title: 'Contract Error',
      message: 'The smart contract rejected this transaction.',
      isUserCanceled: false,
    };
  }

  // Generic error
  return {
    title: 'Transaction Failed',
    message: error.message || 'An unexpected error occurred.',
    isUserCanceled: false,
  };
}

/**
 * Format transaction hash for display
 */
export function formatTransactionHash(hash: string, length: number = 8): string {
  if (hash.length <= length * 2) return hash;
  return `${hash.substring(0, length)}...${hash.substring(hash.length - length)}`;
}

/**
 * Get Stellar Expert link for transaction
 */
export function getTransactionExplorerUrl(hash: string): string {
  const network = STELLAR_CONFIG.network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/**
 * Validate transaction XDR
 */
export function isValidTransactionXDR(xdr: string): boolean {
  try {
    StellarSdk.TransactionBuilder.fromXDR(xdr, STELLAR_CONFIG.networkPassphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Estimate transaction fee
 */
export async function estimateTransactionFee(xdr: string): Promise<string> {
  try {
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      STELLAR_CONFIG.networkPassphrase
    );
    
    const server = getSorobanClient();
    const simulated = await server.simulateTransaction(transaction as any);
    
    if ('minResourceFee' in simulated) {
      return simulated.minResourceFee;
    }
    
    return StellarSdk.BASE_FEE;
  } catch (err) {
    console.error('Error estimating fee:', err);
    return StellarSdk.BASE_FEE;
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 */
export async function checkSufficientBalance(
  publicKey: string,
  requiredAmount: number
): Promise<{ sufficient: boolean; balance: string }> {
  try {
    const server = getSorobanClient();
    const account = await server.getAccount(publicKey);
    
    // Get XLM balance
    const xlmBalance = account.balances.find(
      (b: any) => b.asset_type === 'native'
    );
    
    const balance = xlmBalance ? xlmBalance.balance : '0';
    const balanceNum = parseFloat(balance);
    
    return {
      sufficient: balanceNum >= requiredAmount,
      balance,
    };
  } catch (err) {
    console.error('Error checking balance:', err);
    return { sufficient: false, balance: '0' };
  }
}

/**
 * Retry transaction with exponential backoff
 */
export async function retryTransaction<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      
      // Don't retry user cancellations
      const parsed = parseTransactionError(lastError);
      if (parsed.isUserCanceled) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Transaction status emoji helper
 */
export function getTransactionStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    idle: '⚪',
    building: '🔨',
    signing: '🔐',
    submitting: '📤',
    polling: '⏳',
    success: '✅',
    error: '❌',
  };

  return emojiMap[status] || '⚪';
}

/**
 * Create a transaction memo
 */
export function createTransactionMemo(text: string): StellarSdk.Memo {
  return StellarSdk.Memo.text(text.substring(0, 28)); // Max 28 bytes
}

/**
 * Decode transaction result
 */
export function decodeTransactionResult(result: any): {
  success: boolean;
  operations: any[];
  fee: string;
} {
  try {
    return {
      success: result.status === 'SUCCESS',
      operations: result.operations || [],
      fee: result.fee || '0',
    };
  } catch (err) {
    console.error('Error decoding result:', err);
    return {
      success: false,
      operations: [],
      fee: '0',
    };
  }
}
