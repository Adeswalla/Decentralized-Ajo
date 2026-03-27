'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ContributeButtonProps {
  circleId: string;
  amount: number;
  onSuccess?: () => void;
}

export function ContributeButton({ circleId, amount, onSuccess }: ContributeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleContribute = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to contribute');
        return;
      }

      const response = await fetch(`/api/circles/${circleId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to contribute');
      }

      toast.success('Contribution successful!');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Contribute error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleContribute} disabled={loading} className="w-full">
      {loading ? 'Processing...' : `Contribute ${amount} XLM`}
    </Button>
  );
}
