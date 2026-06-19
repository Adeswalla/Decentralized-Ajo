import Link from 'next/link'
import { Users, ArrowRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import MemberAvatar from './MemberAvatar'

interface GroupCardProps {
  id: string
  name: string
  description: string
  totalPool: number
  currency: 'XLM' | 'USDC'
  members: Array<{ address: string; name?: string }>
  nextPayoutDate: Date
  status: 'active' | 'pending' | 'completed' | 'defaulted'
  yourPosition: number
}

export default function GroupCard({
  id,
  name,
  description,
  totalPool,
  currency,
  members,
  nextPayoutDate,
  status,
  yourPosition,
}: GroupCardProps) {
  const daysUntilPayout = Math.ceil(
    (new Date(nextPayoutDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Link href={`/groups/${id}`}>
      <div className="glass rounded-xl p-6 border border-stellar/20 h-full hover:border-stellar/50 hover:bg-card/60 transition-all duration-300 cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground group-hover:text-stellar transition-colors">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Pool</div>
            <div className="text-2xl font-bold text-stellar">
              {totalPool.toLocaleString()} <span className="text-base text-muted-foreground">{currency}</span>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Users size={14} />
              <span>Members</span>
            </div>
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((member) => (
                <div key={member.address} title={member.name || member.address}>
                  <MemberAvatar address={member.address} size="sm" />
                </div>
              ))}
              {members.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-secondary/30 border border-border flex items-center justify-center text-xs font-medium text-muted-foreground">
                  +{members.length - 3}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground">Your Position</div>
            <div className="text-lg font-bold text-foreground">#{yourPosition}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Payout in</div>
            <div className="text-lg font-bold text-warning">{daysUntilPayout}d</div>
          </div>
          <ArrowRight className="text-stellar/50 group-hover:text-stellar group-hover:translate-x-1 transition-all" size={20} />
        </div>
      </div>
    </Link>
  )
}
