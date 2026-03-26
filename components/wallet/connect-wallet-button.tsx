'use client';

import { useAccount, useEnsName, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);

  const isCorrectNetwork = chainId === 1;

  useEffect(() => {
    if (isConnected && !isCorrectNetwork) {
      setShowNetworkWarning(true);
    } else {
      setShowNetworkWarning(false);
    }
  }, [isConnected, isCorrectNetwork]);

  const handleSwitchNetwork = () => {
    switchChain({ chainId: 1 });
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button onClick={openConnectModal} className="gap-2" variant="default">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        )}
      </ConnectButton.Custom>
    );
  }

  return (
    <div className="relative">
      <ConnectButton.Custom>
        {({ account, openAccountModal }) => (
          <div className="flex flex-col items-end gap-2">
            <Button onClick={openAccountModal} variant="outline" className="gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {ensName || formatAddress(account.address)}
            </Button>

            {showNetworkWarning && (
              <div className="absolute top-full mt-2 right-0 z-50 w-64">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Wrong network! Please switch to Mainnet.
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSwitchNetwork}
                      className="text-destructive h-auto p-0 ml-2"
                    >
                      Switch Now
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        )}
      </ConnectButton.Custom>
    </div>
  );
}
