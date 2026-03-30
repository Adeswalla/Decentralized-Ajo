'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTransactionSubmit } from '@/hooks/use-transaction-submit';
import { useWallet } from '@/lib/wallet-context';

interface ContributeButtonProps {
  circleId: string;
  amount: number;
  onSuccess?: () => void;
}

export function ContributeButton({ circleId, amount, onSuccess }: ContributeButtonProps) {
  const { isConnected } = useWallet();
  const [isBuilding, setIsBuilding] = useState(false);

  const { submitTransaction, isSubmitting, status } = useTransactionSubmit({
    onSuccess: async (hash) => {
      console.log('Transaction confirmed:', hash);
      
      // Update database state after on-chain confirmation
      try {
        const response = await fetch(`/api/circles/${circleId}/contribute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ amount, transactionHash: hash }),
        });

        if (!response.ok) {
          console.error('Failed to update database');
        }

        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error('Error updating database:', err);
      }
    },
    onError: (error) => {
      console.error('Transaction error:', error);
    },
  });

  const handleContribute = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setIsBuilding(true);

      // Fetch the transaction XDR from your backend
      const response = await fetch(`/api/circles/${circleId}/build-contribution-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error('Failed to build transaction');
      }

      const { xdr } = await response.json();

      setIsBuilding(false);

      // Submit the transaction (sign + submit + poll)
      await submitTransaction(xdr);
    } catch (err) {
      setIsBuilding(false);
      console.error('Contribution error:', err);
    }
  };

  const isLoading = isBuilding || isSubmitting;

  return (
    <Button
      onClick={handleContribute}
      disabled={!isConnected}
      isLoading={isLoading}
      className="w-full"
    >
      {isBuilding && 'Building Transaction...'}
      {status === 'signing' && 'Waiting for Signature...'}
      {status === 'submitting' && 'Submitting...'}
      {status === 'polling' && 'Confirming...'}
      {!isLoading && 'Contribute'}
    </Button>
  );
}
