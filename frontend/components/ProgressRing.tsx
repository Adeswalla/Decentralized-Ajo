interface ProgressRingProps {
  percentage: number
  size?: number
  label?: string
}

export default function ProgressRing({ 
  percentage, 
  size = 120, 
  label = 'Progress' 
}: ProgressRingProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a9cf5" />
            <stop offset="100%" stopColor="#3730a3" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold text-stellar">{percentage}%</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
