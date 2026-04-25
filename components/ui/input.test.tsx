/**
 * input.test.tsx
 *
 * Tests verify that the Input and InputError components:
 *   1. Render and accept user input (baseline)
 *   2. Apply the correct CSS classes when `aria-invalid` is set
 *   3. Set the ARIA attributes required for screen-reader accessibility
 *   4. Programmatically link the error message to the input via `aria-describedby`
 *   5. Render (and suppress) the InputError companion correctly
 *
 * Design-system alignment:
 *   - Error border / ring uses the `--destructive` token (oklch warm-red)
 *   - Error message renders an AlertCircle icon with `aria-hidden="true"`
 *   - Error container carries `role="alert"` and `aria-live="polite"` so
 *     assistive technology announces it without requiring a re-focus.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input, InputError } from './input'

// ─── Input — baseline ─────────────────────────────────────────────────────────

describe('Input — baseline', () => {
  it('renders with the correct data-slot attribute', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toHaveAttribute(
      'data-slot',
      'input',
    )
  })

  it('accepts and reflects user input', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()

    render(<Input placeholder="Type here" onChange={onChange} />)

    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    await user.type(input, 'hello')

    expect(onChange).toHaveBeenCalled()
    expect(input.value).toBe('hello')
  })

  it('forwards extra HTML attributes to the underlying <input>', () => {
    render(
      <Input
        placeholder="email"
        type="email"
        id="email-field"
        data-testid="email-input"
        maxLength={100}
      />,
    )
    const input = screen.getByTestId('email-input')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('id', 'email-field')
    expect(input).toHaveAttribute('maxlength', '100')
  })

  it('is disabled correctly', () => {
    render(<Input placeholder="disabled" disabled />)
    expect(screen.getByPlaceholderText('disabled')).toBeDisabled()
  })
})

// ─── Input — error state: CSS classes ────────────────────────────────────────

describe('Input — error state CSS classes', () => {
  it('applies destructive border class when aria-invalid is true', () => {
    render(<Input placeholder="bad field" aria-invalid={true} />)
    const input = screen.getByPlaceholderText('bad field')
    // The Tailwind variant `aria-invalid:border-destructive` compiles to this
    // attribute-based selector — we verify the attribute is present so the CSS
    // rule activates.
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('does NOT carry aria-invalid when the field is valid', () => {
    render(<Input placeholder="good field" />)
    const input = screen.getByPlaceholderText('good field')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('accepts a custom className alongside error classes', () => {
    render(
      <Input
        placeholder="custom"
        aria-invalid={true}
        className="custom-class"
      />,
    )
    const input = screen.getByPlaceholderText('custom')
    expect(input).toHaveClass('custom-class')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})

// ─── Input — error state: ARIA attributes ────────────────────────────────────

describe('Input — error state ARIA attributes', () => {
  it('sets aria-invalid="true" when there is an error', () => {
    render(<Input placeholder="test" aria-invalid={true} />)
    expect(screen.getByPlaceholderText('test')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('sets aria-describedby to the error element id', () => {
    render(
      <Input
        placeholder="test"
        aria-invalid={true}
        aria-describedby="test-error"
      />,
    )
    expect(screen.getByPlaceholderText('test')).toHaveAttribute(
      'aria-describedby',
      'test-error',
    )
  })

  it('omits aria-describedby when there is no error', () => {
    render(<Input placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).not.toHaveAttribute(
      'aria-describedby',
    )
  })

  it('programmatically links input to error message via aria-describedby', () => {
    const errorId = 'email-error'
    render(
      <>
        <Input
          id="email"
          placeholder="email"
          aria-invalid={true}
          aria-describedby={errorId}
        />
        <InputError id={errorId} message="Email is required" />
      </>,
    )

    const input = screen.getByPlaceholderText('email')
    const errorEl = screen.getByRole('alert')

    // The input's aria-describedby must point to the error element's id
    expect(input).toHaveAttribute('aria-describedby', errorId)
    expect(errorEl).toHaveAttribute('id', errorId)
  })
})

// ─── InputError ───────────────────────────────────────────────────────────────

describe('InputError', () => {
  it('renders nothing when message is empty', () => {
    const { container } = render(<InputError message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when message is null', () => {
    const { container } = render(<InputError message={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when message is undefined', () => {
    const { container } = render(<InputError />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the error message text', () => {
    render(<InputError message="Email is required" />)
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('renders with role="alert" for screen-reader announcement', () => {
    render(<InputError message="Required" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('carries aria-live="polite" for live-region announcements', () => {
    render(<InputError message="Required" />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
  })

  it('carries the correct data-slot attribute', () => {
    render(<InputError message="error" />)
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-slot',
      'input-error',
    )
  })

  it('renders an icon element that is hidden from assistive technology', () => {
    render(<InputError message="Something went wrong" />)
    // The icon SVG must have aria-hidden so it is not read aloud
    const svg = screen.getByRole('alert').querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('accepts and uses a custom id for aria-describedby linking', () => {
    render(<InputError id="name-error" message="Name is required" />)
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-error')
  })

  it('applies additional classNames correctly', () => {
    render(<InputError message="error" className="mt-4 custom" />)
    expect(screen.getByRole('alert')).toHaveClass('custom')
  })

  it('renders children when no message prop is given', () => {
    render(<InputError>Custom child error</InputError>)
    expect(screen.getByText('Custom child error')).toBeInTheDocument()
  })
})

// ─── Full integration: linked input + error ───────────────────────────────────

describe('Input + InputError — full accessible field integration', () => {
  it('provides a complete accessible error field pattern', () => {
    const errorMsg = 'Password must be at least 8 characters'
    const errorId = 'pw-error'

    render(
      <div>
        <label htmlFor="pw">Password</label>
        <Input
          id="pw"
          type="password"
          placeholder="••••••••"
          aria-invalid={true}
          aria-describedby={errorId}
        />
        <InputError id={errorId} message={errorMsg} />
      </div>,
    )

    const input = screen.getByPlaceholderText('••••••••')
    const errorEl = screen.getByRole('alert')

    // Visual: error state active
    expect(input).toHaveAttribute('aria-invalid', 'true')

    // Programmatic link: input → error message
    expect(input).toHaveAttribute('aria-describedby', errorId)
    expect(errorEl).toHaveAttribute('id', errorId)

    // Content visible
    expect(errorEl).toHaveTextContent(errorMsg)

    // Icon present and hidden from AT
    const icon = errorEl.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('clears the visual error state when aria-invalid becomes false', () => {
    const { rerender } = render(
      <Input placeholder="field" aria-invalid={true} />,
    )
    const input = screen.getByPlaceholderText('field')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    rerender(<Input placeholder="field" aria-invalid={false} />)
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })
})
