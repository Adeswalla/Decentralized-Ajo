'use client'

import { Copy, Check, LogOut } from 'lucide-react'
import { useState } from 'react'
import BalanceCard from '@/frontend/components/BalanceCard'
import MemberAvatar from '@/frontend/components/MemberAvatar'
import StatusBadge from '@/frontend/components/StatusBadge'

export default function Profile() {
  const [copied, setCopied] = useState(false)

  // Mock data
  const wallet = {
    address: 'GBAB4OROT4CGONSTFYT6YXV34ZSKNQNNIGAGHWGEWYWNXVU6DX7F34Z',
    name: 'Alice Chen',
  }

  const stats = {
    xlmBalance: 145230.50,
    usdcBalance: 5250.75,
    totalContributed: 120,
    totalReceived: 25,
  }

  const groups = [
    {
      id: '1',
      name: 'Tech Friends Savings',
      role: 'Member',
      joinedDate: '2024-01-15',
      status: 'active' as const,
    },
    {
      id: '2',
      name: 'Family Support Fund',
      role: 'Member',
      joinedDate: '2023-12-01',
      status: 'active' as const,
    },
  ]

  const transactions = [
    {
      id: '1',
      group: 'Tech Friends Savings',
      type: 'contribution' as const,
      amount: 5000,
      currency: 'XLM',
      date: '2024-06-20',
      hash: '0x1234567890abcdef',
    },
    {
      id: '2',
      group: 'Family Support Fund',
      type: 'payout' as const,
      amount: 25000,
      currency: 'XLM',
      date: '2024-06-15',
      hash: '0x1234567890abcdef',
    },
    {
      id: '3',
      group: 'Tech Friends Savings',
      type: 'contribution' as const,
      amount: 5000,
      currency: 'XLM',
      date: '2024-05-20',
      hash: '0x1234567890abcdef',
    },
  ]

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">My Wallet</h1>
        <p className="text-muted-foreground">Manage your profile and view all transactions</p>
      </div>

      {/* Wallet Info Card */}
      <div className="glass rounded-xl p-8 border border-stellar/20">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-6">
              <MemberAvatar address={wallet.address} name={wallet.name} size="lg" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">{wallet.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Stellar Testnet</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Wallet Address</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-secondary/20 rounded px-3 py-2 flex-1 text-foreground break-all">
                    {wallet.address}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="p-2 hover:bg-secondary/20 rounded-lg transition-colors text-stellar"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button className="flex items-center gap-2 px-6 py-3 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors font-medium">
            <LogOut size={18} />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Balances */}
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-6">Your Balances</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <BalanceCard token="XLM" amount={stats.xlmBalance} />
          <BalanceCard token="USDC" amount={stats.usdcBalance} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Total Contributed</div>
          <div className="text-3xl font-bold text-foreground">{stats.totalContributed}</div>
          <div className="text-xs text-muted-foreground mt-2">XLM</div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Total Received</div>
          <div className="text-3xl font-bold text-success">{stats.totalReceived}</div>
          <div className="text-xs text-muted-foreground mt-2">XLM</div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Active Groups</div>
          <div className="text-3xl font-bold text-stellar">{groups.length}</div>
          <div className="text-xs text-muted-foreground mt-2">Joined</div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Transactions</div>
          <div className="text-3xl font-bold text-foreground">{transactions.length}</div>
          <div className="text-xs text-muted-foreground mt-2">On-chain</div>
        </div>
      </div>

      {/* Groups List */}
      <div className="glass rounded-xl p-6 border border-stellar/20">
        <h3 className="text-lg font-semibold text-foreground mb-6">Your Groups</h3>
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary/10 transition-colors border border-transparent hover:border-stellar/20"
            >
              <div>
                <h4 className="font-semibold text-foreground">{group.name}</h4>
                <div className="text-sm text-muted-foreground mt-1">
                  Joined {new Date(group.joinedDate).toLocaleDateString()}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={group.status} label={group.role} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass rounded-xl p-6 border border-stellar/20">
        <h3 className="text-lg font-semibold text-foreground mb-6">Transaction History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stellar/20">
                <th className="text-left py-3 text-sm font-medium text-muted-foreground">Group</th>
                <th className="text-left py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-right py-3 text-sm font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-3 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 text-sm font-medium text-muted-foreground">Hash</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-stellar/10 hover:bg-secondary/10 transition-colors">
                  <td className="py-4 text-sm font-medium text-foreground">{tx.group}</td>
                  <td className="py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tx.type === 'contribution'
                        ? 'bg-stellar/20 text-stellar'
                        : 'bg-success/20 text-success'
                    }`}>
                      {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </span>
                  </td>
                  <td className="text-right py-4 text-sm font-semibold text-foreground">
                    {tx.type === 'contribution' ? '-' : '+'}
                    {tx.amount.toLocaleString()} {tx.currency}
                  </td>
                  <td className="text-right py-4 text-sm text-muted-foreground">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="py-4">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stellar hover:underline text-xs font-mono"
                    >
                      {tx.hash.slice(0, 8)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
