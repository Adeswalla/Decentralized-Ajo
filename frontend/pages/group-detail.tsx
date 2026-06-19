'use client'

import { ExternalLink, Users, Calendar, TrendingUp, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import StatusBadge from '@/frontend/components/StatusBadge'
import MemberAvatar from '@/frontend/components/MemberAvatar'
import ProgressRing from '@/frontend/components/ProgressRing'

export default function GroupDetail({ params }: { params: { id: string } }) {
  const [copied, setCopied] = useState(false)

  // Mock data - in production, fetch based on params.id
  const group = {
    id: params.id,
    name: 'Tech Friends Savings',
    description: 'Monthly savings group for tech professionals building wealth together',
    totalPool: 50000,
    currency: 'XLM' as const,
    status: 'active' as const,
    sorobanContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJW3Z5',
    members: [
      {
        address: 'GBAB4OROT4CGONSTFYT6YXV34ZSKNQNNIGAGHWGEWYWNXVU6DX7F34Z',
        name: 'Alice Chen',
        contributed: 15000,
        status: 'paid' as const,
      },
      {
        address: 'GBXC4F4EPYARUPJ33UXLW5B5XKJULBTOD5THWQ5X6VMXNAVYUMPWXVK',
        name: 'Bob Smith',
        contributed: 15000,
        status: 'paid' as const,
      },
      {
        address: 'GCYR56XVVNVGDYXBBPEhighvpq5TDCQDA7FCKYYE42HHVM6WQP5F4I',
        name: 'Charlie Brown',
        contributed: 10000,
        status: 'pending' as const,
      },
      {
        address: 'GDZST3XVCDTUJ76ZAV2HA72KYXM4DEKTQHVJCW35RGL3KPJ7YFLMMU4',
        name: 'Diana Ross',
        contributed: 0,
        status: 'pending' as const,
      },
    ],
    payoutHistory: [
      { recipient: 'Alice Chen', amount: 25000, date: '2024-06-15', status: 'confirmed' },
      { recipient: 'Bob Smith', amount: 25000, date: '2024-05-15', status: 'confirmed' },
    ],
  }

  const copyContractId = () => {
    navigator.clipboard.writeText(group.sorobanContractId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cyclePogress = (group.members.filter(m => m.status === 'paid').length / group.members.length) * 100

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-foreground">{group.name}</h1>
            <StatusBadge status={group.status} />
          </div>
          <p className="text-muted-foreground max-w-2xl">{group.description}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Total Pool</div>
          <div className="text-3xl font-bold text-stellar">
            {group.totalPool.toLocaleString()} <span className="text-base text-muted-foreground">{group.currency}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <Users size={14} />
            <span>Members</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{group.members.length}</div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Cycle Progress</div>
          <div className="text-3xl font-bold text-warning">{Math.round(cyclePogress)}%</div>
        </div>
        <div className="glass rounded-xl p-6 border border-stellar/20">
          <div className="text-sm text-muted-foreground mb-2">Payouts Done</div>
          <div className="text-3xl font-bold text-success">{group.payoutHistory.length}</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Members */}
        <div className="lg:col-span-2">
          {/* Contribution Status */}
          <div className="glass rounded-xl p-6 border border-stellar/20 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-stellar" size={20} />
              <h3 className="text-lg font-semibold text-foreground">Cycle Status</h3>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Contributions Received</span>
                <span className="text-sm text-stellar font-semibold">{cyclePogress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-stellar to-indigo h-full transition-all duration-300 rounded-full"
                  style={{ width: `${cyclePogress}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {group.members.filter(m => m.status === 'paid').length} of {group.members.length} members have contributed this cycle
            </p>
          </div>

          {/* Members List */}
          <div className="glass rounded-xl p-6 border border-stellar/20">
            <h3 className="text-lg font-semibold text-foreground mb-6">Members</h3>
            <div className="space-y-4">
              {group.members.map((member) => (
                <div key={member.address} className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary/10 transition-colors border border-transparent hover:border-stellar/20">
                  <div className="flex-1">
                    <MemberAvatar address={member.address} name={member.name} />
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground mb-1">
                      {member.contributed.toLocaleString()} {group.currency}
                    </div>
                    <StatusBadge
                      status={member.status === 'paid' ? 'completed' : 'pending'}
                      label={member.status === 'paid' ? 'Paid' : 'Pending'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Info */}
        <div className="space-y-8">
          {/* Cycle Progress Ring */}
          <div className="glass rounded-xl p-6 border border-stellar/20 flex justify-center">
            <ProgressRing percentage={Math.round(cyclePogress)} label="Contributions" />
          </div>

          {/* Smart Contract Info */}
          <div className="glass rounded-xl p-6 border border-stellar/20">
            <h3 className="text-lg font-semibold text-foreground mb-4">Soroban Contract</h3>
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-2">Contract Address</div>
              <div className="p-3 bg-secondary/20 rounded-lg border border-stellar/20 break-all font-mono text-xs text-foreground">
                {group.sorobanContractId}
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={copyContractId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-stellar/30 hover:bg-secondary/10 transition-colors text-sm font-medium"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Address
                  </>
                )}
              </button>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${group.sorobanContractId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-stellar/20 hover:bg-stellar/30 transition-colors text-stellar text-sm font-medium"
              >
                <ExternalLink size={16} />
                View on Explorer
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass rounded-xl p-6 border border-stellar/20">
            <h3 className="text-lg font-semibold text-foreground mb-4">Actions</h3>
            <button className="w-full px-4 py-3 rounded-lg bg-stellar hover:bg-stellar/90 text-stellar-foreground font-medium transition-colors mb-3">
              Contribute to Group
            </button>
            <button className="w-full px-4 py-3 rounded-lg border border-stellar/30 text-foreground font-medium hover:bg-secondary/10 transition-colors">
              Invite Members
            </button>
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="glass rounded-xl p-6 border border-stellar/20">
        <h3 className="text-lg font-semibold text-foreground mb-6">Payout History</h3>
        {group.payoutHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stellar/20">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Recipient</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.payoutHistory.map((payout, i) => (
                  <tr key={i} className="border-b border-stellar/10 hover:bg-secondary/10 transition-colors">
                    <td className="py-4 text-sm font-medium text-foreground">{payout.recipient}</td>
                    <td className="text-right py-4 text-sm font-semibold text-foreground">
                      {payout.amount.toLocaleString()} {group.currency}
                    </td>
                    <td className="text-right py-4 text-sm text-muted-foreground">
                      {new Date(payout.date).toLocaleDateString()}
                    </td>
                    <td className="text-right py-4">
                      <StatusBadge status="completed" label="Confirmed" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">No payouts yet. Group is still in contribution phase.</p>
        )}
      </div>
    </div>
  )
}
