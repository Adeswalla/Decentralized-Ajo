import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('renders and accepts user input', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()

    render(
      <Input placeholder="Type here" onChange={onChange} />,
    )

    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    expect(input).toBeInTheDocument()

    await user.type(input, 'hello')
    expect(onChange).toHaveBeenCalled()
    expect(input.value).toBe('hello')
  })
})
