'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCustomTheme } from '@/components/theme-provider'

export function ThemeSelector() {
  const [mounted, setMounted] = useState(false)
  const { themes, selectedIndex, setThemeByIndex } = useCustomTheme()

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-36 h-9" />

  return (
    <Select
      value={String(selectedIndex)}
      onValueChange={(v) => setThemeByIndex(Number(v))}
    >
      <SelectTrigger className="w-36 h-9 text-sm" aria-label="Select theme">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {themes.map((t, i) => (
          <SelectItem key={i} value={String(i)}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
