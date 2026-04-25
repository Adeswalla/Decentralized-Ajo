'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  STELLAR_CONFIG,
  isValidStellarAddress,
  getSorobanClient,
  getAppNetwork,
  passphraseToNetworkName,
  type StellarNetworkName,
} from './stellar-config';
import { authenticatedFetch } from './auth-client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { toast } from 'sonner';
import { mapWalletError, type WalletErrorInfo } from './wallet-errors';

interface SignAndSubmitResult {
  hash: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  response: any;
}

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: WalletErrorInfo | null;
  /** Network the wallet extension is currently set to (null = unknown / not connected). */
  walletNetwork: StellarNetworkName | null;
  /** True when the wallet's network differs from the app's configured network. */
  networkMismatch: boolean;
  /** Dismiss the mismatch warning without disconnecting. */
  dismissMismatch: () => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signTransaction: (transactionXdr: string) => Promise<string>;
  signAndSubmit: (transactionXdr: string, options?: SignAndSubmitOptions) => Promise<SignAndSubmitResult>;
  publicKey: string | null;
}

interface SignAndSubmitOptions {
  pollingTimeout?: number;
  pollingInterval?: number;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<WalletErrorInfo | null>(null);
  const [walletNetwork, setWalletNetwork] = useState<StellarNetworkName | null>(null);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  // Toast errors whenever they occur
  useEffect(() => {
    if (error) {
      toast.error(error.title, {
        description: (
          <div className="mt-1 space-y-2">
            <p className="text-sm">{error.message}</p>
            {error.recoveryStep && (
              <p className="text-xs text-muted-foreground italic">
                {error.recoveryStep}
              </p>
            )}
            {error.cta && (
              <div className="mt-2">
                <a
                  href={error.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline underline-offset-4"
                >
                  {error.cta.label}
                </a>
              </div>
            )}
          </div>
        ),
        duration: 5000,
      });
    }
  }, [error]);

  /** Read the active passphrase from Freighter and update walletNetwork state. */
  const refreshWalletNetwork = useCallback(async () => {
    try {
      const freighter = typeof window !== 'undefined' ? (window as any).freighter : null;
      if (!freighter) return;
      // Freighter ≥ 3.x exposes getNetworkDetails(); older versions expose getNetwork()
      const details =
        typeof freighter.getNetworkDetails === 'function'
          ? await freighter.getNetworkDetails()
          : typeof freighter.getNetwork === 'function'
          ? await freighter.getNetwork()
          : null;
      if (!details) return;
      // getNetworkDetails returns { networkPassphrase, network, … };
      // getNetwork returns passphrase string directly on some older builds.
      const passphrase =
        typeof details === 'string' ? details : details.networkPassphrase ?? details.passphrase;
      if (passphrase) {
        const net = passphraseToNetworkName(passphrase);
        setWalletNetwork(net);
        setMismatchDismissed(false); // reset dismiss on any network change
      }
    } catch {
      // Silently ignore — network details are best-effort
    }
  }, []);

  // Check if wallet is already connected on mount and refresh network
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
          // Always attempt to read network even when not yet connected
          await refreshWalletNetwork();
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    };

    checkConnection();
  }, [refreshWalletNetwork]);

  // Poll for network changes (Freighter doesn't fire an event on network switch)
  useEffect(() => {
    if (!walletAddress) return;
    const interval = setInterval(refreshWalletNetwork, 5000);
    return () => clearInterval(interval);
  }, [walletAddress, refreshWalletNetwork]);

  const networkMismatch =
    !mismatchDismissed &&
    walletNetwork !== null &&
    walletNetwork !== getAppNetwork();

  const dismissMismatch = () => setMismatchDismissed(true);

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

      // Detect wallet's active network immediately after connecting
      await refreshWalletNetwork();

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
      const walletError = mapWalletError(err);
      setError(walletError);
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
      const walletError = mapWalletError(err);
      setError(walletError);
      throw err;
    }
  };

  const signAndSubmit = async (
    transactionXdr: string,
    options: SignAndSubmitOptions = {}
  ): Promise<SignAndSubmitResult> => {
    const { pollingTimeout = 60000, pollingInterval = 2000 } = options;

    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Step 1: Sign the transaction
      const signedXdr = await signTransaction(transactionXdr);

      // Step 2: Submit to network
      const server = getSorobanClient();
      const transaction = new StellarSdk.Transaction(
        signedXdr,
        STELLAR_CONFIG.networkPassphrase
      );

      const sendResponse = await server.sendTransaction(transaction);

      if (sendResponse.status === 'ERROR') {
        throw new Error(
          `Transaction submission failed: ${sendResponse.errorResult?.toString()}`
        );
      }

      const hash = sendResponse.hash;

      // Step 3: Poll for confirmation
      const startTime = Date.now();
      while (Date.now() - startTime < pollingTimeout) {
        const txResponse = await server.getTransaction(hash);

        if (txResponse.status === 'SUCCESS') {
          return {
            hash,
            status: 'SUCCESS',
            response: txResponse,
          };
        }

        if (txResponse.status === 'FAILED') {
          throw new Error(`Transaction failed: ${JSON.stringify(txResponse)}`);
        }

        // Continue polling if NOT_FOUND or PENDING
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }

      // Timeout reached
      throw new Error('Transaction confirmation timeout');
    } catch (err) {
      const walletError = mapWalletError(err);
      setError(walletError);
      throw err;
    }
  };

  const value: WalletContextType = {
    walletAddress,
    publicKey,
    isConnected: !!walletAddress,
    isLoading,
    error,
    walletNetwork,
    networkMismatch,
    dismissMismatch,
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
