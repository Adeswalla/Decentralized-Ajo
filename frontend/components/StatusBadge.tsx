import { CheckCircle, Clock, Zap, AlertCircle } from 'lucide-react'

type Status = 'active' | 'pending' | 'completed' | 'defaulted'

interface StatusBadgeProps {
  status: Status
  label?: string
}

const statusConfig = {
  active: {
    bg: 'bg-stellar/20',
    text: 'text-stellar',
    icon: Zap,
    label: 'Active',
  },
  pending: {
    bg: 'bg-warning/20',
    text: 'text-warning',
    icon: Clock,
    label: 'Pending',
  },
  completed: {
    bg: 'bg-success/20',
    text: 'text-success',
    icon: CheckCircle,
    label: 'Completed',
  },
  defaulted: {
    bg: 'bg-danger/20',
    text: 'text-danger',
    icon: AlertCircle,
    label: 'Defaulted',
  },
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg} ${config.text} text-sm font-medium`}>
      <Icon size={16} />
      <span>{label || config.label}</span>
    </div>
  )
}
