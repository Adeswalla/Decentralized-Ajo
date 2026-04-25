"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Avoid hydration mismatch by waiting until component is mounted
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="p-2 w-24 h-10" />; // Placeholder to avoid layout shift

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 font-medium min-h-[44px] sm:min-h-0"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </Button>
  )
}
