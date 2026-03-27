'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { STELLAR_CONFIG, isValidStellarAddress } from './stellar-config';

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signTransaction: (transactionXdr: string) => Promise<string>;
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
          await fetch('/api/users/update-wallet', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
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

  const value: WalletContextType = {
    walletAddress,
    publicKey,
    isConnected: !!walletAddress,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    signTransaction,
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
