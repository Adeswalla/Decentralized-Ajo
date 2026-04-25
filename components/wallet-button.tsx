'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet-context';
import { KNOWN_NETWORKS } from '@/lib/stellar-config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wallet, Copy, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function WalletButton() {
  const { 
    walletAddress, 
    isConnected, 
    isLoading, 
    walletNetwork, 
    networkMismatch, 
    connectWallet, 
    disconnectWallet,
    error 
  } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    if (error?.type === 'NOT_INSTALLED') {
      return (
        <Button
          asChild
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <a href={error.cta?.href} target="_blank" rel="noopener noreferrer">
            <Wallet className="mr-2 h-4 w-4" />
            Install Freighter
          </a>
        </Button>
      );
    }

    return (
      <Button
        onClick={connectWallet}
        isLoading={isLoading}
        variant="outline"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
    : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Wallet className="mr-2 h-4 w-4" />
          {shortAddress}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5 text-sm flex justify-between items-center">
          <span className="text-muted-foreground">Network</span>
          <span className={`font-medium ${networkMismatch ? 'text-destructive' : ''}`}>
            {walletNetwork ? KNOWN_NETWORKS[walletNetwork]?.label || walletNetwork : 'Unknown'}
          </span>
        </div>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? 'Copied!' : 'Copy Address'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnectWallet}>
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
