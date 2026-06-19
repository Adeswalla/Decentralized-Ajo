'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import CountdownTimer from '@/frontend/components/CountdownTimer'
import BalanceCard from '@/frontend/components/BalanceCard'
import GroupCard from '@/frontend/components/GroupCard'
import StatusBadge from '@/frontend/components/StatusBadge'
import { TrendingUp, Send, ArrowDownLeft } from 'lucide-react'

// Mock data
const mockGroups = [
  {
    id: '1',
    name: 'Tech Friends Savings',
    description: 'Monthly savings group for tech professionals',
    totalPool: 50000,
    currency: 'XLM' as const,
    members: [
      { address: 'GBAB4OROT4CGONSTFYT6YXV34ZSKNQNNIGAGHWGEWYWNXVU6DX7F34Z', name: 'Alice' },
      { address: 'GBXC4F4EPYARUPJ33UXLW5B5XKJULBTOD5THWQ5X6VMXNAVYUMPWXVK', name: 'Bob' },
      { address: 'GCYR56XVVNVGDYXBBPEhighvpq5TDCQDA7FCKYYE42HHVM6WQP5F4I', name: 'Charlie' },
    ],
    nextPayoutDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'active' as const,
    yourPosition: 2,
  },
  {
    id: '2',
    name: 'Family Support Fund',
    description: 'Quarterly savings for family emergencies',
    totalPool: 75000,
    currency: 'XLM' as const,
    members: [
      { address: 'GBAB4OROT4CGONSTFYT6YXV34ZSKNQNNIGAGHWGEWYWNXVU6DX7F34Z', name: 'Mom' },
      { address: 'GBXC4F4EPYARUPJ33UXLW5B5XKJULBTOD5THWQ5X6VMXNAVYUMPWXVK', name: 'Dad' },
    ],
    nextPayoutDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    status: 'active' as const,
    yourPosition: 1,
  },
]

const transactionData = [
  { date: 'Week 1', contributed: 5000, received: 0 },
  { date: 'Week 2', contributed: 5000, received: 0 },
  { date: 'Week 3', contributed: 5000, received: 0 },
  { date: 'Week 4', contributed: 0, received: 25000 },
]

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Manage your savings groups and track contributions</p>
      </div>

      {/* Balance Cards */}
      <div className="grid sm:grid-cols-2 gap-6">
        <BalanceCard token="XLM" amount={145230.50} />
        <BalanceCard token="USDC" amount={5250.75} />
      </div>

      {/* Next Payout Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CountdownTimer targetDate={mockGroups[0].nextPayoutDate} />
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-2 glass rounded-lg p-6 border border-stellar/20">
          <h3 className="text-lg font-semibold text-foreground mb-6">Quick Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Active Groups</div>
              <div className="text-3xl font-bold text-stellar">{mockGroups.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total Contributed</div>
              <div className="text-3xl font-bold text-foreground">120 XLM</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total Received</div>
              <div className="text-3xl font-bold text-success">25 XLM</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="glass rounded-lg p-6 border border-stellar/20">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-stellar" size={20} />
          <h3 className="text-lg font-semibold text-foreground">Contribution History</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={transactionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis dataKey="date" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(10, 156, 245, 0.3)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
            />
            <Bar dataKey="contributed" fill="#0a9cf5" radius={[8, 8, 0, 0]} />
            <Bar dataKey="received" fill="#10b981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions */}
      <div className="glass rounded-lg p-6 border border-stellar/20">
        <h3 className="text-lg font-semibold text-foreground mb-6">Recent Transactions</h3>
        <div className="space-y-4">
          {[
            {
              type: 'contribution',
              group: 'Tech Friends Savings',
              amount: '5,000 XLM',
              date: 'Today at 2:45 PM',
              status: 'confirmed' as const,
            },
            {
              type: 'payout',
              group: 'Family Support Fund',
              amount: '25,000 XLM',
              date: 'Yesterday at 6:30 PM',
              status: 'confirmed' as const,
            },
            {
              type: 'contribution',
              group: 'Tech Friends Savings',
              amount: '5,000 XLM',
              date: '2 days ago',
              status: 'confirmed' as const,
            },
          ].map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary/10 transition-colors border border-transparent hover:border-stellar/20"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  tx.type === 'contribution'
                    ? 'bg-stellar/20 text-stellar'
                    : 'bg-success/20 text-success'
                }`}>
                  {tx.type === 'contribution' ? (
                    <Send size={20} />
                  ) : (
                    <ArrowDownLeft size={20} />
                  )}
                </div>
                <div>
                  <div className="font-medium text-foreground">{tx.group}</div>
                  <div className="text-sm text-muted-foreground">{tx.date}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">{tx.amount}</div>
                <StatusBadge status={tx.status === 'confirmed' ? 'completed' : 'pending'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Groups */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Your Active Groups</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {mockGroups.map((group) => (
            <GroupCard key={group.id} {...group} />
          ))}
        </div>
      </div>
    </div>
  )
}
