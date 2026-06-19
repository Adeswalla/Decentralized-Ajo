import { Eye, EyeOff } from 'lucide-react'

interface BalanceCardProps {
  token: 'XLM' | 'USDC'
  amount: number
  showBalance?: boolean
}

export default function BalanceCard({ token, amount, showBalance = true }: BalanceCardProps) {
  const colors = {
    XLM: 'from-stellar to-blue-600',
    USDC: 'from-indigo to-purple-600',
  }

  const icons = {
    XLM: '★',
    USDC: 'U',
  }

  return (
    <div className={`glass rounded-xl p-6 border border-stellar/20 bg-gradient-to-br ${colors[token]}/10`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[token]} flex items-center justify-center text-white font-bold text-lg`}>
          {icons[token]}
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{token}</span>
      </div>
      
      <div className="mb-2">
        {showBalance ? (
          <div className="text-3xl font-bold text-foreground">
            {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ) : (
          <div className="text-3xl font-bold text-muted-foreground">••••••</div>
        )}
      </div>
      
      <div className="text-sm text-muted-foreground">
        Balance
      </div>
    </div>
  )
}
