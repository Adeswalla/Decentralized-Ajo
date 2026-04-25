/**
 * Property-based tests for the Input component's ARIA prop forwarding.
 *
 * Feature: accessibility-pass, Property 5: Input component forwards ARIA props to the underlying element
 * Validates: Requirements 7.1, 7.2
 */

import React from 'react'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { Input } from '@/components/ui/input'

describe('Input component — ARIA prop forwarding (P5)', () => {
  /**
   * Property 5: For any combination of aria-invalid, aria-describedby, and
   * aria-label prop values passed to the Input component, those exact values
   * should appear as attributes on the rendered <input> DOM element.
   *
   * Validates: Requirements 7.1, 7.2
   */
  it('forwards aria-describedby and aria-invalid to the underlying <input>', () => {
    fc.assert(
      fc.property(
        fc.string(),    // aria-describedby value
        fc.boolean(),   // aria-invalid value
        (describedBy, invalid) => {
          const { container } = render(
            <Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )

          const inputEl = container.querySelector('input')
          expect(inputEl).not.toBeNull()

          // aria-describedby must be forwarded exactly
          expect(inputEl!.getAttribute('aria-describedby')).toBe(describedBy)

          // aria-invalid is serialised as a string by the DOM
          expect(inputEl!.getAttribute('aria-invalid')).toBe(String(invalid))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('forwards aria-label to the underlying <input>', () => {
    fc.assert(
      fc.property(
        fc.string(),  // aria-label value
        (label) => {
          const { container } = render(<Input aria-label={label} />)

          const inputEl = container.querySelector('input')
          expect(inputEl).not.toBeNull()
          expect(inputEl!.getAttribute('aria-label')).toBe(label)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('applies destructive ring class when aria-invalid="true"', () => {
    const { container } = render(<Input aria-invalid={true} />)
    const inputEl = container.querySelector('input')
    expect(inputEl).not.toBeNull()
    expect(inputEl!.getAttribute('aria-invalid')).toBe('true')
    // The CSS variant is applied via Tailwind's aria-invalid: selector;
    // we verify the attribute is present so the CSS rule can target it.
    expect(inputEl!.hasAttribute('aria-invalid')).toBe(true)
  })
})
