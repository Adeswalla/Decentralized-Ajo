'use client';

import { useWallet } from '@/lib/wallet-context';
import { getAppNetwork, getNetworkDisplayLabel, KNOWN_NETWORKS } from '@/lib/stellar-config';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Globe, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function NetworkIndicator() {
  const { isConnected, networkMismatch } = useWallet();
  const appNetwork = getAppNetwork();
  const label = getNetworkDisplayLabel();
  const color = KNOWN_NETWORKS[appNetwork].color;

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1",
          color === 'emerald' ? 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/50 text-amber-600 bg-amber-500/10'
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="font-medium text-xs tracking-wide uppercase">{label}</span>
      </Badge>
      
      {isConnected && networkMismatch && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center bg-destructive/10 text-destructive rounded-full p-1 border border-destructive/20 animate-pulse cursor-help">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Wallet and App network mismatch!</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
