'use client';

import { useWallet } from '@/lib/wallet-context';
import { getNetworkDisplayLabel } from '@/lib/stellar-config';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function NetworkMismatchModal() {
  const { networkMismatch, dismissMismatch, disconnectWallet } = useWallet();
  const expectedNetwork = getNetworkDisplayLabel();

  return (
    <Dialog open={networkMismatch} onOpenChange={(open) => {
      if (!open) dismissMismatch();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>Network Mismatch</DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground">
            Your wallet is connected to the wrong network. This application requires you to be on <strong className="font-semibold">{expectedNetwork}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-md text-sm space-y-3">
          <p>
            To fix this, please open your Stellar wallet extension (e.g. Freighter, Lobstr):
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the wallet extension</li>
            <li>Click the gear icon (Settings)</li>
            <li>Go to <strong>Preferences</strong> &gt; <strong>Network</strong></li>
            <li>Select <strong>{expectedNetwork}</strong></li>
          </ol>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={disconnectWallet}>
            Disconnect Wallet
          </Button>
          <Button onClick={dismissMismatch}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
