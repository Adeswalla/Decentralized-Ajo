import React from 'react';
import { useTxHistory } from '../hooks/useTxHistory';
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

export function ChatHistorySidebar() {
  const { txHistory } = useTxHistory();

  return (
    <aside className="w-64 border-r bg-background h-screen flex flex-col p-4">
      <div className="flex-1 overflow-y-auto">
        <h2 className="font-semibold mb-4 text-sm text-muted-foreground">Chat History</h2>
        <div className="space-y-2">
          {/* Chat history items would go here */}
          <div className="p-3 bg-muted rounded text-xs text-muted-foreground cursor-pointer hover:bg-muted/80">
            Previous Session
          </div>
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 px-1">Recent Transactions</h3>
        {txHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">No transactions yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-thin">
            {txHistory.map((tx, idx) => (
              <div 
                key={idx} 
                className="group flex flex-col gap-1 p-2 rounded-md bg-accent/50 text-xs border border-border/50"
              >
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    {tx.status === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className="text-foreground">{tx.type}</span>
                  </div>
                  <a 
                    href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-1 rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-all"
                    title="View on Stellar Expert"
                  >
                    <ExternalLink className="w-3 h-3 text-primary" />
                  </a>
                </div>
                <div className="flex items-center justify-between mt-1 text-muted-foreground">
                  <span className="font-mono text-[10px]">{tx.hash.slice(0, 8)}...</span>
                  <span className="text-[10px]">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
