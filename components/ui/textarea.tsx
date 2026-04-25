import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Multi-line text input with the same consistent error state as `<Input>`.
 *
 * ARIA contract mirrors `<Input>`:
 * - Set `aria-invalid="true"` when there is a validation error.
 * - Set `aria-describedby` to the id of the associated `<InputError>` element.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground dark:bg-input/30',
        'flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs',
        'transition-[color,box-shadow] outline-none md:text-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Focus — matches Input
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // Error state — matches Input exactly
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:bg-destructive/5',
        'dark:aria-invalid:ring-destructive/40 dark:aria-invalid:bg-destructive/10',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
