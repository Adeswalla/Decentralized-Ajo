import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders and responds to click', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()

    render(
      <Button onClick={onClick} size="lg">
        Click me
      </Button>,
    )

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows loader when isLoading is true and disables button', () => {
    render(
      <Button isLoading>
        Submit
      </Button>,
    )

    const button = screen.getByRole('button', { name: /submit/i })
    expect(button).toBeDisabled()
    expect(screen.getByText(/submit/i)).toBeInTheDocument()
    expect(button.querySelector('svg')).toBeTruthy()
  })
})
