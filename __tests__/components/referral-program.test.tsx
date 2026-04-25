/**
 * Test suite for Referral Program Component
 * Closes #608
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferralProgram } from '@/components/referral/referral-program';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

global.fetch = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock window.open
global.open = jest.fn();

const mockReferralData = {
  referralLink: 'http://localhost:3000/auth/register?ref=wallet123',
  stats: {
    totalReferrals: 10,
    pendingReferrals: 3,
    confirmedReferrals: 5,
    rewardsEarned: 50,
  },
  referredUsers: [
    {
      id: '1',
      email: 'user1@example.com',
      status: 'pending' as const,
      joinedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      email: 'user2@example.com',
      status: 'qualified' as const,
      joinedAt: '2024-01-10T10:00:00Z',
    },
    {
      id: '3',
      email: 'user3@example.com',
      status: 'rewarded' as const,
      joinedAt: '2024-01-05T10:00:00Z',
      rewardAmount: 10,
    },
  ],
};

describe('ReferralProgram Component (Issue #608)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockReferralData,
    });
  });

  it('should generate and display referral link with wallet address', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockReferralData.referralLink)).toBeInTheDocument();
    });
  });

  it('should display copy button for referral link', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });
  });

  it('should copy referral link to clipboard when copy button is clicked', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockReferralData.referralLink);
      expect(toast.success).toHaveBeenCalledWith('Referral link copied to clipboard!');
    });
  });

  it('should display referral stats: total, pending, confirmed, rewards', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Total
      expect(screen.getByText('3')).toBeInTheDocument(); // Pending
      expect(screen.getByText('5')).toBeInTheDocument(); // Confirmed
      expect(screen.getByText('$50')).toBeInTheDocument(); // Rewards
    });
  });

  it('should display share buttons for Twitter/X, Telegram, and WhatsApp', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      expect(screen.getByText('Telegram')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });
  });

  it('should open Twitter share dialog when Twitter button is clicked', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
    });

    const twitterButton = screen.getByText('Twitter/X');
    fireEvent.click(twitterButton);

    expect(global.open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank'
    );
  });

  it('should open Telegram share dialog when Telegram button is clicked', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Telegram')).toBeInTheDocument();
    });

    const telegramButton = screen.getByText('Telegram');
    fireEvent.click(telegramButton);

    expect(global.open).toHaveBeenCalledWith(
      expect.stringContaining('t.me/share/url'),
      '_blank'
    );
  });

  it('should open WhatsApp share dialog when WhatsApp button is clicked', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    const whatsappButton = screen.getByText('WhatsApp');
    fireEvent.click(whatsappButton);

    expect(global.open).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank'
    );
  });

  it('should display referred users list with status', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      expect(screen.getByText('user3@example.com')).toBeInTheDocument();
    });

    // Check status badges
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Rewarded')).toBeInTheDocument();
  });

  it('should show status badges: pending, qualified, rewarded', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      const pendingBadge = screen.getByText('Pending');
      const qualifiedBadge = screen.getByText('Qualified');
      const rewardedBadge = screen.getByText('Rewarded');

      expect(pendingBadge).toBeInTheDocument();
      expect(qualifiedBadge).toBeInTheDocument();
      expect(rewardedBadge).toBeInTheDocument();
    });
  });

  it('should display reward amount for rewarded users', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('+$10')).toBeInTheDocument();
    });
  });

  it('should show empty state when no referrals exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockReferralData,
        referredUsers: [],
      }),
    });

    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('No referrals yet')).toBeInTheDocument();
      expect(screen.getByText('Share your link to get started!')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<ReferralProgram />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load referral data');
    });
  });

  it('should show loading state while fetching data', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<ReferralProgram />);

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('should include wallet address as query parameter in referral link', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      const input = screen.getByDisplayValue(mockReferralData.referralLink);
      expect(input).toHaveValue(expect.stringContaining('?ref=wallet123'));
    });
  });

  it('should change copy button text to "Copied" after copying', async () => {
    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('should reset copy button text after 2 seconds', async () => {
    jest.useFakeTimers();

    render(<ReferralProgram />);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});
