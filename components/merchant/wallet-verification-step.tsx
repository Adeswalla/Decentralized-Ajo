/**
 * Wallet Verification Step Component
 * Closes #619
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface WalletVerificationStepProps {
  onComplete?: () => void;
}

export function WalletVerificationStep({ onComplete }: WalletVerificationStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnectWallet = async () => {
    setIsConnecting(true);

    try {
      // Check if Freighter is installed
      if (!(window as any).freighter) {
        toast.error('Freighter wallet not found. Please install it first.');
        setIsConnecting(false);
        return;
      }

      // Request wallet connection
      const publicKey = await (window as any).freighter.getPublicKey();

      if (publicKey) {
        setWalletAddress(publicKey);

        // Request signature for verification
        const message = `Verify wallet for Stellar Ajo merchant account at ${new Date().toISOString()}`;
        const signature = await (window as any).freighter.signMessage(message);

        if (signature) {
          setIsVerified(true);
          toast.success('Wallet verified successfully!');
        }
      }
    } catch (error) {
      toast.error('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleContinue = () => {
    if (isVerified) {
      onComplete?.();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle>Wallet Verification</CardTitle>
        </div>
        <CardDescription>
          Connect and verify your Stellar wallet using Freighter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Before you begin:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Install the Freighter wallet browser extension</li>
                <li>Create or import your Stellar account</li>
                <li>Make sure you're on the correct network (Testnet or Mainnet)</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* Freighter Installation Link */}
        {!(window as any)?.freighter && (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Freighter Wallet Not Detected</p>
              <p className="text-sm text-muted-foreground">
                Install Freighter to continue
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open('https://www.freighter.app/', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Install Freighter
            </Button>
          </div>
        )}

        {/* Wallet Connection */}
        {!isVerified ? (
          <div className="space-y-4">
            <Button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Freighter Wallet
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>Click the button above to connect your wallet</p>
              <p>You'll be asked to sign a message to verify ownership</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success State */}
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Wallet Verified
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 font-mono">
                  {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
                </p>
              </div>
            </div>

            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue to Next Step
            </Button>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Why verify your wallet?</strong>
          </p>
          <p>
            Wallet verification ensures you have control over the account that will receive
            campaign payments and manage your merchant activities.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
