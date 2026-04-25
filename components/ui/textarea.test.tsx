/**
 * textarea.test.tsx
 *
 * Verifies that the Textarea component mirrors the exact same accessible
 * error-state contract as Input:
 *   - Correct CSS selector hook (aria-invalid attribute)
 *   - ARIA attributes: aria-invalid, aria-describedby
 *   - Compatible with InputError for programmatic linking
 *   - Baseline behaviour (render, typing, disabled, forwarded attrs)
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from './textarea'
import { InputError } from './input'

// ─── Baseline ─────────────────────────────────────────────────────────────────

describe('Textarea — baseline', () => {
  it('renders with the correct data-slot attribute', () => {
    render(<Textarea placeholder="Write here" />)
    expect(screen.getByPlaceholderText('Write here')).toHaveAttribute(
      'data-slot',
      'textarea',
    )
  })

  it('accepts and reflects user input', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()

    render(<Textarea placeholder="Write here" onChange={onChange} />)
    const ta = screen.getByPlaceholderText('Write here') as HTMLTextAreaElement

    await user.type(ta, 'hello world')

    expect(onChange).toHaveBeenCalled()
    expect(ta.value).toBe('hello world')
  })

  it('forwards extra HTML attributes', () => {
    render(
      <Textarea
        placeholder="notes"
        id="notes-field"
        data-testid="notes-ta"
        rows={5}
        maxLength={500}
      />,
    )
    const ta = screen.getByTestId('notes-ta')
    expect(ta).toHaveAttribute('id', 'notes-field')
    expect(ta).toHaveAttribute('rows', '5')
    expect(ta).toHaveAttribute('maxlength', '500')
  })

  it('is disabled correctly', () => {
    render(<Textarea placeholder="disabled" disabled />)
    expect(screen.getByPlaceholderText('disabled')).toBeDisabled()
  })
})

// ─── Error state: CSS classes ────────────────────────────────────────────────

describe('Textarea — error state CSS classes', () => {
  it('exposes aria-invalid="true" which activates destructive Tailwind variants', () => {
    render(<Textarea placeholder="bio" aria-invalid={true} />)
    // Tailwind variants `aria-invalid:border-destructive` etc. are activated
    // by the presence of `aria-invalid="true"` on the element.
    expect(screen.getByPlaceholderText('bio')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('does not set aria-invalid when field is valid', () => {
    render(<Textarea placeholder="bio" />)
    expect(screen.getByPlaceholderText('bio')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('merges a custom className without clobbering error classes', () => {
    render(
      <Textarea
        placeholder="bio"
        aria-invalid={true}
        className="my-custom-class"
      />,
    )
    const ta = screen.getByPlaceholderText('bio')
    expect(ta).toHaveClass('my-custom-class')
    expect(ta).toHaveAttribute('aria-invalid', 'true')
  })
})

// ─── Error state: ARIA attributes ────────────────────────────────────────────

describe('Textarea — error state ARIA attributes', () => {
  it('sets aria-invalid="true" when there is an error', () => {
    render(<Textarea placeholder="test" aria-invalid={true} />)
    expect(screen.getByPlaceholderText('test')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('sets aria-describedby to the error element id', () => {
    render(
      <Textarea
        placeholder="test"
        aria-invalid={true}
        aria-describedby="bio-error"
      />,
    )
    expect(screen.getByPlaceholderText('test')).toHaveAttribute(
      'aria-describedby',
      'bio-error',
    )
  })

  it('omits aria-describedby when there is no error', () => {
    render(<Textarea placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).not.toHaveAttribute(
      'aria-describedby',
    )
  })
})

// ─── Full integration: Textarea + InputError ──────────────────────────────────

describe('Textarea + InputError — full accessible field integration', () => {
  it('programmatically links textarea to error message via aria-describedby', () => {
    const errorId = 'bio-error'

    render(
      <>
        <label htmlFor="bio">Bio</label>
        <Textarea
          id="bio"
          placeholder="Tell us about yourself"
          aria-invalid={true}
          aria-describedby={errorId}
        />
        <InputError id={errorId} message="Bio is required" />
      </>,
    )

    const ta = screen.getByPlaceholderText('Tell us about yourself')
    const errorEl = screen.getByRole('alert')

    // Visual: error state active
    expect(ta).toHaveAttribute('aria-invalid', 'true')

    // Programmatic link: textarea → error message
    expect(ta).toHaveAttribute('aria-describedby', errorId)
    expect(errorEl).toHaveAttribute('id', errorId)

    // Content and icon
    expect(errorEl).toHaveTextContent('Bio is required')
    const icon = errorEl.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('clears the visual error state when aria-invalid becomes false', () => {
    const { rerender } = render(
      <Textarea placeholder="bio" aria-invalid={true} />,
    )
    const ta = screen.getByPlaceholderText('bio')
    expect(ta).toHaveAttribute('aria-invalid', 'true')

    rerender(<Textarea placeholder="bio" aria-invalid={false} />)
    expect(ta).toHaveAttribute('aria-invalid', 'false')
  })

  it('error disappears from DOM when InputError receives no message', () => {
    const { rerender } = render(
      <>
        <Textarea
          placeholder="note"
          aria-invalid={true}
          aria-describedby="note-error"
        />
        <InputError id="note-error" message="Note is required" />
      </>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Simulate field becoming valid — error message clears
    rerender(
      <>
        <Textarea placeholder="note" aria-invalid={false} />
        <InputError id="note-error" message="" />
      </>,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
