import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/providers/Web3Provider'; 
import toast from 'react-hot-toast';
import { type Hash } from 'viem';

export interface ToastTxOptions {
  chainId?: number;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

export const handleTransactionToast = async (
  hash: Hash,
  options: ToastTxOptions = {}
) => {
  const {
    chainId = 11155111, // Defaulting to Sepolia
    loadingMessage = 'Transaction Pending...',
    successMessage = 'Transaction Successful!',
    errorMessage = 'Transaction Failed!'
  } = options;

  let explorerBaseUrl = 'https://etherscan.io';
  if (chainId === 11155111) {
    explorerBaseUrl = 'https://sepolia.etherscan.io';
  } else if (chainId === 137) {
    explorerBaseUrl = 'https://polygonscan.com';
  } else if (chainId === 8453) {
    explorerBaseUrl = 'https://basescan.org';
  } else if (chainId === 10) {
    explorerBaseUrl = 'https://optimistic.etherscan.io';
  }

  const explorerUrl = `${explorerBaseUrl}/tx/${hash}`;

  const toastId = toast.loading(
    loadingMessage + `\n\nView on Etherscan:\n${explorerUrl}`
  );

  try {
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
    
    if (receipt.status === 'success') {
      toast.success(
        successMessage + `\n\nView on Etherscan:\n${explorerUrl}`,
        { id: toastId, duration: 6000 }
      );
    } else {
      toast.error(
        errorMessage + `\n\nTransaction reverted.\nView on Etherscan:\n${explorerUrl}`,
        { id: toastId, duration: 8000 }
      );
    }
    
    return receipt;
  } catch (error) {
    console.error('Transaction receipt waiting error:', error);
    toast.error(
      errorMessage + `\n\nFailed to fetch receipt.\nView on Etherscan:\n${explorerUrl}`,
      { id: toastId, duration: 8000 }
    );
    throw error;
  }
};
