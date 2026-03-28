'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import StellarSdk from 'stellar-sdk';
import { STELLAR_CONFIG, isValidStellarAddress } from './stellar-config';
import { authenticatedFetch } from './auth-client';

interface SignAndSubmitResult {
  hash: string;
  ledger: number;
  successful: boolean;
  timestamp: number;
}

interface SignAndSubmitOptions {
  pollingTimeout?: number;
  pollingInterval?: number;
}

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signTransaction: (transactionXdr: string) => Promise<string>;
  signAndSubmit: (transactionXdr: string, options?: SignAndSubmitOptions) => Promise<SignAndSubmitResult>;
  publicKey: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).freighter) {
          const pubKey = await (window as any).freighter.getPublicKey();
          if (pubKey && isValidStellarAddress(pubKey)) {
            setPublicKey(pubKey);
            setWalletAddress(pubKey);
            // Store in localStorage
            localStorage.setItem('walletAddress', pubKey);
          }
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    };

    checkConnection();
  }, []);

  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window) {
        throw new Error('Window is not available');
      }

      const freighter = (window as any).freighter;

      if (!freighter) {
        throw new Error(
          'Freighter wallet not found. Please install Freighter extension.'
        );
      }

      // Request public key
      const pubKey = await freighter.getPublicKey();

      if (!isValidStellarAddress(pubKey)) {
        throw new Error('Invalid Stellar address returned from wallet');
      }

      setPublicKey(pubKey);
      setWalletAddress(pubKey);

      // Store in localStorage
      localStorage.setItem('walletAddress', pubKey);

      // Update user record with wallet address
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await authenticatedFetch('/api/users/update-wallet', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              walletAddress: pubKey,
            }),
          });
        } catch (err) {
          console.error('Error updating wallet address in database:', err);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setPublicKey(null);
    setError(null);
    localStorage.removeItem('walletAddress');
  };

  const signTransaction = async (transactionXdr: string): Promise<string> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const freighter = (window as any).freighter;

      if (!freighter) {
        throw new Error('Freighter wallet not found');
      }

      const signedXdr = await freighter.signTransaction(
        transactionXdr,
        STELLAR_CONFIG.networkPassphrase
      );

      return signedXdr;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign transaction';
      setError(errorMessage);
      throw err;
    }
  };

  const signAndSubmit = async (
    transactionXdr: string,
    options: SignAndSubmitOptions = {}
  ): Promise<SignAndSubmitResult> => {
    const { pollingTimeout = 30000, pollingInterval = 1000 } = options;

    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Step 1: Sign the transaction
      const signedXdr = await signTransaction(transactionXdr);

      // Step 2: Build transaction object
      const transaction = new StellarSdk.Transaction(
        signedXdr,
        STELLAR_CONFIG.networkPassphrase
      );

      // Step 3: Submit to network
      const server = new StellarSdk.Server(STELLAR_CONFIG.horizonUrl);
      const submissionPromise = server.submitTransaction(transaction);

      // Step 4: Wait for confirmation with timeout
      const startTime = Date.now();
      let lastError: Error | null = null;

      while (Date.now() - startTime < pollingTimeout) {
        try {
          const result = await Promise.race([
            submissionPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Polling timeout')),
                pollingInterval
              )
            ),
          ]);

          return {
            hash: result.hash,
            ledger: result.ledger,
            successful: result.successful,
            timestamp: Date.now(),
          };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // Continue polling
          await new Promise((resolve) => setTimeout(resolve, pollingInterval));
        }
      }

      throw lastError || new Error('Transaction confirmation timeout');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign and submit transaction';
      setError(errorMessage);
      throw err;
    }
  };

  const value: WalletContextType = {
    walletAddress,
    publicKey,
    isConnected: !!walletAddress,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    signTransaction,
    signAndSubmit,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
