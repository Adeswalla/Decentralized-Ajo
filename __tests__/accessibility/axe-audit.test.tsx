/**
 * Axe audit tests — zero critical/serious violations on targeted surfaces.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// jsdom doesn't support portals — render them inline.
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock next/navigation for page components that use useRouter.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// Mock authenticatedFetch and clearAuthState from @/lib/auth-client.
jest.mock('@/lib/auth-client', () => ({
  authenticatedFetch: jest.fn(),
  clearAuthState: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run axe on a container and return only critical/serious violations.
 */
async function getCriticalOrSeriousViolations(container: Element) {
  const results = await axe(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  });
  return results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
}

// ---------------------------------------------------------------------------
// 1. Login form — Requirement 6.1
// ---------------------------------------------------------------------------

describe('Login form (/auth/login) — axe audit', () => {
  it('6.1 — has zero critical/serious axe violations', async () => {
    const LoginPage = (await import('@/app/auth/login/page')).default;
    const { container } = render(<LoginPage />);

    const violations = await getCriticalOrSeriousViolations(container);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Register form — Requirement 6.2
// ---------------------------------------------------------------------------

describe('Register form (/auth/register) — axe audit', () => {
  it('6.2 — has zero critical/serious axe violations', async () => {
    const RegisterPage = (await import('@/app/auth/register/page')).default;
    const { container } = render(<RegisterPage />);

    const violations = await getCriticalOrSeriousViolations(container);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Circle creation form — Requirement 6.3
// ---------------------------------------------------------------------------

describe('Circle creation form (/circles/create) — axe audit', () => {
  it('6.3 — has zero critical/serious axe violations', async () => {
    const CreateCirclePage = (await import('@/app/circles/create/page')).default;
    const { container } = render(<CreateCirclePage />);

    const violations = await getCriticalOrSeriousViolations(container);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Governance dialog — Requirement 6.4
// ---------------------------------------------------------------------------

describe('Governance dialog — axe audit', () => {
  it('6.4 — has zero critical/serious axe violations when dialog is open', async () => {
    const { CreateProposalDialog } = await import(
      '@/components/governance/create-proposal-dialog'
    );
    const user = userEvent.setup();
    const { container } = render(
      <CreateProposalDialog onSubmit={() => Promise.resolve()} />,
    );

    // Open the dialog before running axe.
    const trigger = screen.getByRole('button', { name: /new proposal/i });
    await user.click(trigger);

    // Wait for dialog to be present.
    await screen.findByRole('dialog');

    const violations = await getCriticalOrSeriousViolations(container);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Profile form — Requirement 6.5
// ---------------------------------------------------------------------------

describe('Profile form — axe audit', () => {
  it('6.5 — has zero critical/serious axe violations', async () => {
    const { ProfileForm } = await import('@/components/profile-form');
    const { container } = render(
      <ProfileForm
        initialData={{
          firstName: 'Jane',
          lastName: 'Doe',
          username: 'janedoe',
          notificationEmail: 'jane@example.com',
          bio: '',
        }}
      />,
    );

    const violations = await getCriticalOrSeriousViolations(container);
    expect(violations).toHaveLength(0);
  });
});
