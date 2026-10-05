/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfirmActionDialog } from './confirm-action-dialog';

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

  it('AC3: a rejecting onConfirm leaves the dialog open and re-enables its controls', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(new Error('boom')));
    // The component deliberately rethrows the rejection for the consumer to
    // surface (AC3) -- swallow the resulting unhandled-rejection noise here
    // (Vitest/Node routes it through `process`, not jsdom's `window`).
    const unhandled = (_reason: unknown, promise: Promise<unknown>) => {
      promise.catch(() => {});
    };
    process.on('unhandledRejection', unhandled);

    render(<Harness onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();

    window.removeEventListener('unhandledrejection', unhandled);
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
