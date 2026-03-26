import { useState, useEffect } from 'react';

export type TxStatus = 'success' | 'failed';
export type TxType = 'Deposit' | 'Withdraw';

export interface TxEntry {
  hash: string;
  status: TxStatus;
  timestamp: string;
  type: TxType;
}

export function useTxHistory() {
  const [txHistory, setTxHistory] = useState<TxEntry[]>([]);

  // Load initially from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('stellar_tx_history');
      if (stored) {
        setTxHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse tx history', e);
    }
  }, []);

  const addTx = (hash: string, status: TxStatus, type: TxType) => {
    const newEntry: TxEntry = {
      hash,
      status,
      timestamp: new Date().toISOString(),
      type,
    };

    setTxHistory((prev: TxEntry[]) => {
      const updated = [newEntry, ...prev].slice(0, 10);
      try {
        localStorage.setItem('stellar_tx_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save tx history', e);
      }
      return updated;
    });
  };

  return {
    txHistory,
    addTx,
  };
}
