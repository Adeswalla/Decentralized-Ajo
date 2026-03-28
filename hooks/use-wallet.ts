'use client';

import { useAccount, useBalance, useEnsName, useEnsAvatar } from 'wagmi';

export function useWallet() {
  const { address, isConnected, isDisconnected, chainId } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ address });

  return {
    address,
    isConnected,
    isDisconnected,
    chainId,
    balance,
    ensName,
    ensAvatar,
    formattedAddress: address 
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : null,
  };
}
