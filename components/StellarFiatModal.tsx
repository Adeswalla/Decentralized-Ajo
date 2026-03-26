import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useTxHistory } from '../hooks/useTxHistory';

export function StellarFiatModal({ onSuccess }: { onSuccess?: () => void }) {
  const { addTx } = useTxHistory();
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);

  // Simulated submission
  const handleSubmit = () => {
    const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    setTxHash(hash);
    setStatus('success');
    addTx(hash, 'success', 'Deposit');
    onSuccess?.();
  };

  const copyToClipboard = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="modal-container p-6 bg-background rounded-lg shadow-lg border">
      <h2 className="text-lg font-bold mb-4">Stellar Fiat Bridge</h2>
      
      {status === 'idle' ? (
        <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded">
          Submit Transaction
        </button>
      ) : (
        <div className="success-state flex items-center justify-between p-3 bg-accent/50 rounded-md">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-green-500">Transaction Successful!</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Hash:</span>
              <a 
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1 text-primary hover:underline text-xs"
              >
                {txHash.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
              </a>
              <button 
                onClick={copyToClipboard} 
                aria-label="Copy hash" 
                className="p-1.5 hover:bg-accent rounded-md transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
