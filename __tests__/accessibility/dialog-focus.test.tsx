/**
 * Dialog focus management tests.
 *
 * Verifies that dialogs correctly manage focus on open/close, trap focus while
 * open, and respond to Escape and backdrop-click dismissal.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProposalDialog } from '@/components/governance/create-proposal-dialog';
import { Modal } from '@/components/modal';

// jsdom doesn't support portals — render them inline so we can query the DOM.
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => Promise.resolve();

// ---------------------------------------------------------------------------
// CreateProposalDialog (Radix UI) — focus management
// ---------------------------------------------------------------------------

describe('CreateProposalDialog (Radix UI) — focus management', () => {
  it('5.1 — moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    render(<CreateProposalDialog onSubmit={noop} />);

    const trigger = screen.getByRole('button', { name: /new proposal/i });
    await user.click(trigger);

    // After opening, focus should be inside the dialog content — not on the trigger.
    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused).not.toBe(trigger);
      expect(focused).not.toBe(document.body);
    });
  });

  it('5.2 — returns focus to the trigger element when the dialog closes', async () => {
    const user = userEvent.setup();
    render(<CreateProposalDialog onSubmit={noop} />);

    const trigger = screen.getByRole('button', { name: /new proposal/i });
    await user.click(trigger);

    // Close via the Cancel button.
    const cancelBtn = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('5.4 — Escape key closes the dialog', async () => {
    const user = userEvent.setup();
    render(<CreateProposalDialog onSubmit={noop} />);

    await user.click(screen.getByRole('button', { name: /new proposal/i }));

    // Dialog should be visible.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Modal (custom) — focus management
// ---------------------------------------------------------------------------

function ModalHarness({
  disableBackdropClose = false,
}: {
  disableBackdropClose?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open Modal
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        disableBackdropClose={disableBackdropClose}
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">Test Modal</h2>
        <button>First</button>
        <button>Second</button>
        <button>Last</button>
      </Modal>
    </>
  );
}

describe('Modal (custom) — focus management', () => {
  it('5.1 — moves focus into the modal panel when it opens', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused).not.toBe(trigger);
      expect(focused).not.toBe(document.body);
      // The modal panel itself receives focus (tabIndex={-1} on the panel div).
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(focused) || focused === dialog).toBe(true);
    });
  });

  it('5.2 — returns focus to the trigger when the modal closes via Escape', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: /open modal/i });
    await user.click(trigger);

    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('5.3 — Tab stays within the modal (focus trap)', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: /open modal/i }));
    await screen.findByRole('dialog');

    // Tab through all focusable elements; focus should wrap back inside.
    const dialog = screen.getByRole('dialog');
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => !el.hasAttribute('disabled'));

    // Tab through every element plus one extra to verify wrap-around.
    for (let i = 0; i <= focusable.length; i++) {
      await user.tab();
    }

    // After wrapping, focus must still be inside the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('5.3 — Shift+Tab stays within the modal (reverse focus trap)', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: /open modal/i }));
    await screen.findByRole('dialog');

    const dialog = screen.getByRole('dialog');

    // Shift+Tab multiple times — focus must remain inside.
    for (let i = 0; i < 4; i++) {
      await user.tab({ shift: true });
    }

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('5.4 — Escape key closes the modal', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: /open modal/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('5.5 — clicking the backdrop closes the modal', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: /open modal/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // The backdrop is a <button aria-label="Close dialog"> rendered before the panel.
    const backdrop = screen.getByRole('button', { name: /close dialog/i });
    await user.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('5.5 — backdrop click does NOT close the modal when disableBackdropClose=true', async () => {
    const user = userEvent.setup();
    render(<ModalHarness disableBackdropClose />);

    await user.click(screen.getByRole('button', { name: /open modal/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const backdrop = screen.getByRole('button', { name: /close dialog/i });
    await user.click(backdrop);

    // Dialog should still be open.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
