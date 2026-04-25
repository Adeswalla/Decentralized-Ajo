import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './dashboard'
import { useWallet } from '@/lib/wallet-context'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/dashboard',
  }),
}))

jest.mock('@/lib/wallet-context', () => ({
  useWallet: jest.fn(),
}))

describe('Dashboard', () => {
  it('shows wallet disconnected state when not connected', async () => {
    const user = userEvent.setup()
    const connectWallet = jest.fn()

    ;(useWallet as jest.Mock).mockReturnValue({
      isConnected: false,
      isLoading: false,
      connectWallet,
    })

    render(<Dashboard activeGroups={[]} />)

    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(connectWallet).toHaveBeenCalledTimes(1)
  })
})
