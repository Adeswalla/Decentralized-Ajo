import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './modal'

describe('Modal', () => {
  it('renders children when open and calls close on backdrop click', () => {
    const onClose = jest.fn()

    render(
      <Modal isOpen onClose={onClose}>
        <div>Modal Content</div>
      </Modal>,
    )

    expect(screen.getByText('Modal Content')).toBeInTheDocument()

    const backdrop = screen.getByRole('button', { name: /close dialog/i })
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when disableBackdropClose is true', () => {
    const onClose = jest.fn()

    render(
      <Modal isOpen onClose={onClose} disableBackdropClose>
        <div>Locked Modal</div>
      </Modal>,
    )

    const backdrop = screen.getByRole('button', { name: /close dialog/i })
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn()

    render(
      <Modal isOpen onClose={onClose}>
        <div>Escape Modal</div>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27, charCode: 27 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
