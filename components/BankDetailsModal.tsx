import React, { useState } from 'react';
import { TransferTimeline, TimelineEvent } from './TransferTimeline';

export function BankDetailsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Mock timeline events for a payout transfer
  const events: TimelineEvent[] = [
    { status: 'initiated', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    { status: 'pending', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    { status: 'success', timestamp: new Date().toISOString() },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
          Payout Status
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </h2>
        
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-sm font-medium mb-1 text-muted-foreground">Bank Details</h3>
          <p className="font-mono text-xs">Account: **** **** 1234</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">Bank: JP Morgan Chase</p>
        </div>

        <div className="border border-border p-4 rounded-xl">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Transfer Timeline
          </h3>
          <TransferTimeline events={events} />
        </div>
      </div>
    </div>
  );
}
