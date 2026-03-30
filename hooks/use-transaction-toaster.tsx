'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWaitForTransactionReceipt } from 'wagmi';

export function useTransactionToaster(hash?: string | null) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!hash) return;

    if (isLoading) {
      toast.loading('Transaction pending...', { id: hash });
    }

    if (isSuccess) {
      toast.success('Transaction confirmed!', { id: hash });
    }

    if (isError) {
      toast.error('Transaction failed.', { id: hash });
    }
  }, [isLoading, isSuccess, isError, hash]);
}
