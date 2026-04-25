'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { motion, AnimatePresence } from 'framer-motion'

import { cn } from '@/lib/utils'

/**
 * Switch component with Framer Motion-driven thumb animation.
 *
 * The root Radix primitive manages all a11y (role, aria-checked, keyboard).
 * We intercept the `checked` / `defaultChecked` / `onCheckedChange` props so
 * we can maintain a local boolean that is always in sync with the real state,
 * then feed that boolean directly into Framer Motion's `animate` prop.
 *
 * This eliminates the CSS data-attribute race condition that caused the thumb
 * to get stuck mid-animation on rapid clicks.
 */
function Switch({
  className,
  checked: controlledChecked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  // Track checked state internally so Framer Motion always has a stable boolean.
  const [isChecked, setIsChecked] = React.useState<boolean>(
    controlledChecked ?? defaultChecked ?? false,
  )

  // Keep in sync when the parent controls the value.
  React.useEffect(() => {
    if (controlledChecked !== undefined) {
      setIsChecked(controlledChecked)
    }
  }, [controlledChecked])

  const handleCheckedChange = React.useCallback(
    (next: boolean) => {
      // If uncontrolled, update local state immediately so the animation
      // starts on the same frame as the click — no waiting for a re-render.
      if (controlledChecked === undefined) {
        setIsChecked(next)
      }
      onCheckedChange?.(next)
    },
    [controlledChecked, onCheckedChange],
  )

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={controlledChecked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleCheckedChange}
      className={cn(
        'peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isChecked
          ? 'bg-primary'
          : 'bg-input dark:bg-input/80',
        className,
      )}
      {...props}
    >
      {/*
       * We render a plain <span> as the Radix Thumb so Radix keeps its
       * internal DOM structure, then overlay a Framer Motion element that
       * handles the visual translation.  Using `asChild` lets us pass the
       * motion element directly as the Radix Thumb child.
       */}
      <SwitchPrimitive.Thumb asChild data-slot="switch-thumb">
        <motion.span
          className={cn(
            'pointer-events-none block size-4 rounded-full ring-0',
            isChecked
              ? 'bg-background dark:bg-primary-foreground'
              : 'bg-background dark:bg-foreground',
          )}
          /**
           * `animate` is driven by `isChecked` — a plain boolean that is
           * updated synchronously on every click.  Framer Motion will
           * interrupt any in-progress animation and spring toward the new
           * target immediately, so rapid clicks always resolve correctly.
           */
          animate={{ x: isChecked ? 'calc(100% - 2px)' : 0 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
            mass: 0.6,
          }}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
