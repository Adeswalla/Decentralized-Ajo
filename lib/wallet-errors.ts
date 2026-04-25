/**
 * Centralized wallet error mapping for Freighter and Stellar SDK interactions.
 * Maps technical error messages to user-friendly titles, descriptions, and recovery steps.
 */

export type WalletErrorType = 
  | 'NOT_INSTALLED'
  | 'LOCKED'
  | 'USER_DECLINED'
  | 'NETWORK_MISMATCH'
  | 'INVALID_ADDRESS'
  | 'SUBMISSION_FAILED'
  | 'GENERIC';

export interface WalletErrorInfo {
  type: WalletErrorType;
  title: string;
  message: string;
  recoveryStep?: string;
  docLink?: string;
  cta?: {
    label: string;
    href: string;
  };
}

export const WALLET_ERROR_MAPPING: Record<WalletErrorType, WalletErrorInfo> = {
  NOT_INSTALLED: {
    type: 'NOT_INSTALLED',
    title: "Freighter Not Found",
    message: "The Freighter extension is not installed or detected in your browser.",
    recoveryStep: "Please install the Freighter extension to securely connect your Stellar wallet.",
    cta: {
      label: "Install Freighter",
      href: "https://www.freighter.app/",
    },
  },
  LOCKED: {
    type: 'LOCKED',
    title: "Wallet Locked",
    message: "Your Freighter wallet is currently locked.",
    recoveryStep: "Please open the Freighter extension and enter your password to unlock it, then try again.",
  },
  USER_DECLINED: {
    type: 'USER_DECLINED',
    title: "Request Cancelled",
    message: "The request was declined in your wallet.",
    recoveryStep: "You need to approve the connection or signature request in Freighter to proceed.",
  },
  NETWORK_MISMATCH: {
    type: 'NETWORK_MISMATCH',
    title: "Network Mismatch",
    message: "Your wallet is connected to the wrong network.",
    recoveryStep: "Please switch your Freighter wallet to the correct network in the extension settings.",
    docLink: "https://docs.freighter.app/using-freighter/switching-networks",
  },
  INVALID_ADDRESS: {
    type: 'INVALID_ADDRESS',
    title: "Invalid Address",
    message: "The wallet returned an invalid Stellar address.",
    recoveryStep: "Try reconnecting your wallet or using a different account.",
  },
  SUBMISSION_FAILED: {
    type: 'SUBMISSION_FAILED',
    title: "Transaction Failed",
    message: "The transaction could not be submitted to the network.",
    recoveryStep: "This might be due to insufficient funds, an expired transaction, or network congestion. Please check your balance and try again.",
  },
  GENERIC: {
    type: 'GENERIC',
    title: "Wallet Error",
    message: "An unexpected error occurred with your wallet.",
    recoveryStep: "Please try refreshing the page or reconnecting your wallet.",
  },
};

/**
 * Maps a technical error (Error object or string) to a structured WalletErrorInfo.
 */
export function mapWalletError(error: any): WalletErrorInfo {
  const rawMessage = typeof error === 'string' ? error : error?.message || '';
  
  // Extension missing
  if (rawMessage.includes('not found') || rawMessage.includes('not detected') || rawMessage.includes('Freighter wallet not found')) {
    return WALLET_ERROR_MAPPING.NOT_INSTALLED;
  }
  
  // Rejection
  if (
    rawMessage.includes('User declined') || 
    rawMessage.includes('declined access') || 
    rawMessage.includes('User declined to sign') ||
    rawMessage.includes('cancelled')
  ) {
    return WALLET_ERROR_MAPPING.USER_DECLINED;
  }
  
  // Locked
  if (rawMessage.toLowerCase().includes('locked')) {
    return WALLET_ERROR_MAPPING.LOCKED;
  }
  
  // Network issues
  if (rawMessage.includes('Network mismatch') || rawMessage.includes('wrong network')) {
    return WALLET_ERROR_MAPPING.NETWORK_MISMATCH;
  }

  // Address issues
  if (rawMessage.includes('Invalid Stellar address')) {
    return WALLET_ERROR_MAPPING.INVALID_ADDRESS;
  }

  // Submission issues
  if (rawMessage.includes('submission failed') || rawMessage.includes('Transaction submission failed')) {
    return WALLET_ERROR_MAPPING.SUBMISSION_FAILED;
  }

  return {
    ...WALLET_ERROR_MAPPING.GENERIC,
    message: rawMessage || WALLET_ERROR_MAPPING.GENERIC.message
  };
}
