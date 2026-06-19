'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  targetDate: Date
  label?: string
}

export default function CountdownTimer({ targetDate, label = 'Next Payout' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  if (!timeLeft) return null

  return (
    <div className="glass rounded-lg p-4 border border-stellar/20">
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Clock size={16} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: timeLeft.days, unit: 'Days' },
          { value: timeLeft.hours, unit: 'Hours' },
          { value: timeLeft.minutes, unit: 'Mins' },
          { value: timeLeft.seconds, unit: 'Secs' },
        ].map((item) => (
          <div key={item.unit} className="text-center">
            <div className="bg-stellar/10 rounded-lg p-2 mb-1">
              <div className="text-xl font-bold text-stellar">
                {String(item.value).padStart(2, '0')}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{item.unit}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
