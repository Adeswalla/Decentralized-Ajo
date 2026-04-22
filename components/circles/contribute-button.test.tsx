'use client';

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ContributeButton } from './contribute-button';

// ── mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/wallet-context', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/hooks/use-transaction-submit', () => ({
  useTransactionSubmit: jest.fn(),
}));

// Keep a stable reference to the mock so individual tests can override it.
const mockSubmitTransaction = jest.fn();
const mockUseWallet = require('@/lib/wallet-context').useWallet as jest.Mock;
const mockUseTransactionSubmit = require('@/hooks/use-transaction-submit')
  .useTransactionSubmit as jest.Mock;

function setWalletConnected(connected: boolean) {
  mockUseWallet.mockReturnValue({ isConnected: connected });
}

function setSubmitHook(overrides: Record<string, unknown> = {}) {
  mockUseTransactionSubmit.mockReturnValue({
    submitTransaction: mockSubmitTransaction,
    isSubmitting: false,
    status: 'idle',
    ...overrides,
  });
}

// Silence window.alert
beforeAll(() => {
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  setWalletConnected(true);
  setSubmitHook();
  global.fetch = jest.fn();
  Storage.prototype.getItem = jest.fn(() => 'test-token');
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('ContributeButton – double-submit guard', () => {
  it('renders enabled when wallet is connected', () => {
    render(<ContributeButton circleId="circle-1" amount={100} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('is disabled when wallet is not connected', () => {
    setWalletConnected(false);
    render(<ContributeButton circleId="circle-1" amount={100} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled while building the transaction', async () => {
    // Simulate a slow build-tx request so isBuilding stays true
    let resolveFetch!: (value: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<ContributeButton circleId="circle-1" amount={100} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    // Button should become disabled while awaiting the XDR fetch
    await waitFor(() => expect(button).toBeDisabled());

    // Clean up: resolve so async tasks settle before unmount
    act(() => {
      resolveFetch({ ok: true, status: 200, json: async () => ({ xdr: 'test-xdr' }) });
    });
  });

  it('is disabled while the transaction is submitting', () => {
    setSubmitHook({ isSubmitting: true, status: 'signing' });

    render(<ContributeButton circleId="circle-1" amount={100} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not fire a second submission when clicked again while in-flight', async () => {
    // First click triggers a slow fetch; ref guard must block the second click.
    let resolveFetch!: (value: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<ContributeButton circleId="circle-1" amount={100} />);
    const button = screen.getByRole('button');

    // First click — starts the in-flight request
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    // Second click — button is disabled so the browser won't fire onClick,
    // but as an extra safety net the ref guard also prevents re-entry.
    fireEvent.click(button);

    // fetch should have been called exactly once
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Resolve so there are no unhandled promise rejections after the test
    act(() => {
      resolveFetch({ ok: true, status: 200, json: async () => ({ xdr: 'test-xdr' }) });
    });
  });

  it('re-enables after a failed build request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      { ok: false, status: 500, json: async () => ({ error: 'server error' }) }
    );

    render(<ContributeButton circleId="circle-1" amount={100} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    // Should re-enable after the error
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
