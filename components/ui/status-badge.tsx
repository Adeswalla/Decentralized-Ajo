import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'absolute z-10 flex items-center justify-center rounded-full font-medium ring-2 ring-background',
  {
    variants: {
      color: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-white',
        success: 'bg-green-500 text-white',
        warning: 'bg-yellow-500 text-white',
        secondary: 'bg-secondary text-secondary-foreground',
      },
      size: {
        sm: 'min-w-[1rem] h-4 text-[10px] px-1',
        md: 'min-w-[1.25rem] h-5 text-xs px-1',
        lg: 'min-w-[1.5rem] h-6 text-xs px-1.5',
      },
      position: {
        'top-right': '-top-1 -right-1',
        'top-left': '-top-1 -left-1',
        'bottom-right': '-bottom-1 -right-1',
        'bottom-left': '-bottom-1 -left-1',
      },
    },
    defaultVariants: {
      color: 'default',
      size: 'md',
      position: 'top-right',
    },
  },
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Numeric count to display. Omit or set variant="dot" for a dot indicator. */
  count?: number
  /** Maximum count before showing "{max}+". Defaults to 99. */
  max?: number
  /** Show as a dot regardless of count. */
  dot?: boolean
}

function StatusBadge({
  className,
  color,
  size,
  position,
  count,
  max = 99,
  dot = false,
  ...props
}: StatusBadgeProps) {
  const isDot = dot || count === undefined

  const label =
    !isDot && count !== undefined
      ? count > max
        ? `${max}+`
        : String(count)
      : null

  return (
    <span
      data-slot="status-badge"
      className={cn(
        statusBadgeVariants({ color, size, position }),
        isDot && 'h-2.5 w-2.5 min-w-0 p-0',
        className,
      )}
      aria-label={label ? `${label} notifications` : undefined}
      {...props}
    >
      {label}
    </span>
  )
}

/**
 * Wrapper that sets `position: relative` on its child so StatusBadge
 * can be positioned absolutely over it.
 *
 * Usage:
 *   <BadgeWrapper>
 *     <BellIcon />
 *     <StatusBadge count={5} />
 *   </BadgeWrapper>
 */
function BadgeWrapper({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="badge-wrapper"
      className={cn('relative inline-flex', className)}
      {...props}
    />
  )
}

export { StatusBadge, BadgeWrapper, statusBadgeVariants }
