import * as React from 'react'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A styled input component with consistent, accessible error state handling.
 *
 * ARIA contract:
 * - `aria-invalid="true"` — triggers the destructive border/ring visual and
 *   renders the error icon inside the wrapper. Screen readers expose this state.
 * - `aria-describedby` — should point to the associated `<FieldError>` / `<p>`
 *   id so that assistive technology reads the error message when the field is
 *   focused. Connect this automatically via `<FormControl>` or manually:
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Input
 *     id="email"
 *     aria-invalid={!!errors.email}
 *     aria-describedby={errors.email ? "email-error" : undefined}
 *   />
 * </div>
 * {errors.email && (
 *   <p id="email-error" role="alert" className="text-sm text-destructive flex items-center gap-1 mt-1">
 *     <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
 *     {errors.email}
 *   </p>
 * )}
 * ```
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs',
        'transition-[color,box-shadow] outline-none',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        // Focus ring — uses brand primary colour
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // Error state — visually distinct destructive border + ring + slight background tint
        // Uses `aria-invalid` as the CSS hook so the browser's own accessibility
        // tree stays in sync with the visual state at all times.
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:bg-destructive/5',
        'dark:aria-invalid:ring-destructive/40 dark:aria-invalid:bg-destructive/10',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Standardised inline error message for use beneath any form input.
 *
 * - Renders a destructive-coloured `AlertCircle` icon alongside the message.
 * - Sets `role="alert"` so screen readers announce the error without requiring
 *   the user to re-focus the field.
 * - Accepts an optional `id` which should match the input's `aria-describedby`.
 */
interface InputErrorProps extends React.ComponentProps<'p'> {
  /** The error message to display. Renders nothing when falsy. */
  message?: string | null
}

function InputError({ id, message, className, children, ...props }: InputErrorProps) {
  const content = message ?? children
  if (!content) return null

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      data-slot="input-error"
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-sm font-medium text-destructive',
        className,
      )}
      {...props}
    >
      <AlertCircle
        aria-hidden="true"
        className="size-3.5 shrink-0"
      />
      <span>{content}</span>
    </p>
  )
}

export { Input, InputError }
