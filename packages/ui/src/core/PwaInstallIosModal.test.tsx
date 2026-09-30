/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Share, SquarePlus } from 'lucide-react';
import { PwaInstallIosModal } from './PwaInstallIosModal';

const labels = {
  title: 'How to install',
  shareStepText: 'Tap the Share icon',
  addToHomeScreenStepText: "Tap 'Add to Home Screen'",
  closeLabel: 'Close',
};

// A minimal localStorage mock so the test can assert AC14's "does not touch
// localStorage" behavior without depending on jsdom's real implementation.
function installLocalStorageSpy() {
  const store = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => {
    store.set(key, value);
  });
  const removeItem = vi.fn((key: string) => {
    store.delete(key);
  });
  vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(setItem as any);
  vi.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(removeItem as any);
  return { setItem, removeItem };
}

describe('PwaInstallIosModal (Story 0.38 AC13, AC14)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders both numbered steps with their icon + instruction text when open', () => {
    render(
      <PwaInstallIosModal
        open
        labels={labels}
        shareIcon={Share}
        addToHomeScreenIcon={SquarePlus}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(labels.title)).toBeInTheDocument();
    expect(screen.getByText(labels.shareStepText)).toBeInTheDocument();
    expect(screen.getByText(labels.addToHomeScreenStepText)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <PwaInstallIosModal
        open={false}
        labels={labels}
        shareIcon={Share}
        addToHomeScreenIcon={SquarePlus}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onClose (and does not touch localStorage) when the close button is clicked', () => {
    const onClose = vi.fn();
    const { setItem, removeItem } = installLocalStorageSpy();
    render(
      <PwaInstallIosModal
        open
        labels={labels}
        shareIcon={Share}
        addToHomeScreenIcon={SquarePlus}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.closeLabel }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('calls onClose (and does not touch localStorage) when the overlay is clicked', () => {
    const onClose = vi.fn();
    const { setItem, removeItem } = installLocalStorageSpy();
    render(
      <PwaInstallIosModal
        open
        labels={labels}
        shareIcon={Share}
        addToHomeScreenIcon={SquarePlus}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('pwa-install-ios-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('calls onClose (and does not touch localStorage) when Escape is pressed', () => {
    const onClose = vi.fn();
    const { setItem, removeItem } = installLocalStorageSpy();
    render(
      <PwaInstallIosModal
        open
        labels={labels}
        shareIcon={Share}
        addToHomeScreenIcon={SquarePlus}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
