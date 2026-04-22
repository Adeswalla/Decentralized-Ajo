import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── mocks ────────────────────────────────────────────────────────────────────

// Next.js navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

// sonner toast
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// auth-client
jest.mock('@/lib/auth-client', () => ({
  authenticatedFetch: jest.fn(),
}));

const mockAuthenticatedFetch = require('@/lib/auth-client').authenticatedFetch as jest.Mock;

// Import after mocks are registered
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JoinCirclePage = require('./page').default;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Resolves a GET /join preview call with a valid circle payload */
function mockPreviewSuccess(overrides: Record<string, unknown> = {}) {
  mockAuthenticatedFetch.mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({
      circle: {
        id: 'circle-abc',
        name: 'Test Circle',
        contributionAmount: 50,
        contributionFrequencyDays: 7,
        maxRounds: 10,
        currentRound: 2,
        status: 'ACTIVE',
        organizer: { email: 'organizer@test.com' },
        members: [{ id: 'member-1' }],
        ...overrides,
      },
      alreadyMember: false,
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Storage.prototype.getItem = jest.fn(() => 'test-token');
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('JoinCirclePage – double-submit guard on Confirm Join', () => {
  it('shows "Confirm Join" button after a successful preview lookup', async () => {
    mockPreviewSuccess();

    render(<JoinCirclePage />);

    fireEvent.change(screen.getByPlaceholderText(/clx1abc2def3/i), {
      target: { value: 'circle-abc' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm join/i })).toBeInTheDocument());
  });

  it('"Confirm Join" is disabled while the join request is in-flight', async () => {
    mockPreviewSuccess();

    // Make the POST hang so we can inspect the in-flight state
    let resolveJoin!: (value: unknown) => void;
    mockAuthenticatedFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveJoin = resolve;
      })
    );

    render(<JoinCirclePage />);

    // Look up the circle first
    fireEvent.change(screen.getByPlaceholderText(/clx1abc2def3/i), {
      target: { value: 'circle-abc' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }));

    const joinButton = await screen.findByRole('button', { name: /confirm join/i });

    // Click join → button should become disabled
    fireEvent.click(joinButton);
    await waitFor(() => expect(joinButton).toBeDisabled());

    // Resolve so there are no dangling promises
    resolveJoin({ status: 200, ok: true, json: async () => ({}) });
  });

  it('does not submit twice when "Confirm Join" is clicked rapidly', async () => {
    mockPreviewSuccess();

    let resolveJoin!: (value: unknown) => void;
    mockAuthenticatedFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveJoin = resolve;
      })
    );

    render(<JoinCirclePage />);

    fireEvent.change(screen.getByPlaceholderText(/clx1abc2def3/i), {
      target: { value: 'circle-abc' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }));

    const joinButton = await screen.findByRole('button', { name: /confirm join/i });

    // Rapid double-click
    fireEvent.click(joinButton);
    fireEvent.click(joinButton);

    await waitFor(() => expect(joinButton).toBeDisabled());

    // authenticatedFetch: 1 GET (preview) + 1 POST (join) = 2 total
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);

    resolveJoin({ status: 200, ok: true, json: async () => ({}) });
  });

  it('re-enables "Confirm Join" after a failed join request', async () => {
    mockPreviewSuccess();

    mockAuthenticatedFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<JoinCirclePage />);

    fireEvent.change(screen.getByPlaceholderText(/clx1abc2def3/i), {
      target: { value: 'circle-abc' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }));

    const joinButton = await screen.findByRole('button', { name: /confirm join/i });
    fireEvent.click(joinButton);

    await waitFor(() => expect(joinButton).not.toBeDisabled());
  });
});
