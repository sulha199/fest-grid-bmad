/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { OVERLAY_MODAL_Z } from './overlay-z';

afterEach(() => {
  cleanup();
});

function Harness({
  onConfirm,
  onCancel,
  confirmVariant,
}: {
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmVariant?: 'default' | 'destructive';
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        data-testid="trigger"
      >
        Open
      </button>
      <ConfirmActionDialog
        open={open}
        title="Merge events?"
        description="This cannot be undone."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        confirmVariant={confirmVariant}
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </div>
  );
}

describe('ConfirmActionDialog (Story 0.47)', () => {
  it('AC1: opening moves focus into the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Radix's Dialog.Content moves focus to itself (or its first focusable
    // descendant) once mounted.
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toContainElement(
        document.activeElement as HTMLElement
      );
    });
  });

  it('AC1: Escape calls onCancel and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onConfirm={vi.fn()} onCancel={onCancel} />);

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('AC1: clicking the overlay calls onCancel identically to Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onConfirm={vi.fn()} onCancel={onCancel} />);

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    // Radix renders a full-screen overlay sibling to the content; clicking
    // outside the Content (but inside the Portal) triggers onPointerDownOutside.
    const overlay = document.querySelector('[data-radix-popper-content-wrapper], .fixed.inset-0.bg-black');
    expect(overlay).toBeTruthy();
    await user.pointer({ target: overlay as Element, keys: '[MouseLeft]' });

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('AC1/AC3: clicking Cancel calls onCancel and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onConfirm={vi.fn()} onCancel={onCancel} />);

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('AC3: Confirm disables both buttons while onConfirm is pending, then closes and returns focus on resolution', async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );
    render(<Harness onConfirm={onConfirm} onCancel={vi.fn()} />);

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(cancelButton).toBeDisabled();

    // Escape/overlay-click are also disabled while confirming.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    resolveConfirm();

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('AC3/FIND-080: a rejecting onConfirm leaves the dialog open, re-enables its controls, and raises no unhandled rejection', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(new Error('boom')));
    // FIND-080 (c): the primitive no longer rethrows inside its internal
    // `.then` rejection handler (there is nothing downstream to catch that
    // rethrow, so it only produced an unhandled rejection). Fail the test if
    // one is observed anyway.
    const onUnhandledRejection = vi.fn();
    process.on('unhandledRejection', onUnhandledRejection);

    render(<Harness onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();

    // Give any (incorrectly) unhandled rejection a turn of the microtask/macrotask
    // queue to surface before asserting it never fired.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onUnhandledRejection).not.toHaveBeenCalled();

    process.off('unhandledRejection', onUnhandledRejection);
  });

  it('FIND-080 (a): a successful onConfirm resets isConfirming, so a reopened dialog has Confirm enabled', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.resolve());
    // Consumer deliberately keeps the dialog open on success instead of
    // flipping `open={false}` -- exercises the primitive's own reset, not
    // the unmount-on-close path already covered by the AC3 "disables...then
    // closes" test above.
    function KeepOpenHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)} data-testid="trigger">
            Open
          </button>
          <ConfirmActionDialog
            open={open}
            title="Merge events?"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            onConfirm={onConfirm}
            onCancel={() => setOpen(false)}
          />
        </div>
      );
    }
    render(<KeepOpenHarness />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);

    // After the successful confirm resolves, the dialog (still open per the
    // consumer's choice) must have its Confirm/Cancel controls re-enabled --
    // not stuck disabled from the pending state.
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
  });

  it('FIND-080 (b): a consumer-handled error that does not rethrow re-enables Cancel and Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    // Mirrors `duplicate-events-content.tsx`'s pattern: `onConfirm` catches
    // its own error, reports it elsewhere (e.g. a toast), and resolves
    // successfully instead of rethrowing.
    const onConfirm = vi.fn(async () => {
      try {
        throw new Error('backend rejected the merge');
      } catch {
        // handled -- intentionally not rethrown
      }
    });

    function KeepOpenHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)} data-testid="trigger">
            Open
          </button>
          <ConfirmActionDialog
            open={open}
            title="Merge events?"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            onConfirm={onConfirm}
            onCancel={() => {
              onCancel();
              setOpen(false);
            }}
          />
        </div>
      );
    }
    render(<KeepOpenHarness />);

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancelButton).not.toBeDisabled());

    // Escape was blocked only while `isConfirming` was true; once reset it
    // must behave identically to Cancel again.
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('FIND-080 (review): a synchronous throw from onConfirm re-enables Cancel and Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    // Not async: throws before any promise exists, so only a try/catch around the call can see it.
    const onConfirm = vi.fn(() => {
      throw new Error('sync failure before any promise');
    });

    function SyncThrowHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)} data-testid="trigger">
            Open
          </button>
          <ConfirmActionDialog
            open={open}
            title="Merge events?"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            onConfirm={onConfirm}
            onCancel={() => {
              onCancel();
              setOpen(false);
            }}
          />
        </div>
      );
    }
    render(<SyncThrowHarness />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled());
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('FIND-081: Overlay and Content carry the AD-33 OVERLAY_MODAL_Z tier class', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const content = screen.getByRole('alertdialog');
    expect(content.className).toContain(OVERLAY_MODAL_Z);

    const overlay = document.querySelector('.fixed.inset-0.bg-black');
    expect(overlay).toBeTruthy();
    expect((overlay as HTMLElement).className).toContain(OVERLAY_MODAL_Z);
  });

  it('AC4: confirmVariant="destructive" renders the Button destructive variant', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} onCancel={vi.fn()} confirmVariant="destructive" />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton.className).toContain('bg-destructive');
  });
});
