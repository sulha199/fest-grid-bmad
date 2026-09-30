/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PwaInstallBanner } from './PwaInstallBanner';

const labels = {
  message: 'Install FestDaily for faster access.',
  installButtonLabel: 'Install',
  howToInstallButtonLabel: 'How to install',
  notNowButtonLabel: 'Not now',
  remindLaterButtonLabel: 'Remind me in 2 weeks',
};

describe('PwaInstallBanner (Story 0.38 AC10, AC12)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the three controls in order for android: "Not now", "Remind me in 2 weeks", "Install"', () => {
    render(
      <PwaInstallBanner
        labels={labels}
        platform="android"
        onInstallClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    expect(screen.getByText(labels.message)).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      labels.notNowButtonLabel,
      labels.remindLaterButtonLabel,
      labels.installButtonLabel,
    ]);
  });

  it('uses "How to install" as the primary action label on iOS', () => {
    render(
      <PwaInstallBanner
        labels={labels}
        platform="ios"
        onInstallClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      labels.notNowButtonLabel,
      labels.remindLaterButtonLabel,
      labels.howToInstallButtonLabel,
    ]);
  });

  it('fires onInstallClick when the primary action is clicked', () => {
    const onInstallClick = vi.fn();
    render(
      <PwaInstallBanner
        labels={labels}
        platform="android"
        onInstallClick={onInstallClick}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.installButtonLabel }));
    expect(onInstallClick).toHaveBeenCalledTimes(1);
  });

  it('fires onDismissPermanent when "Not now" is clicked', () => {
    const onDismissPermanent = vi.fn();
    render(
      <PwaInstallBanner
        labels={labels}
        platform="android"
        onInstallClick={vi.fn()}
        onDismissPermanent={onDismissPermanent}
        onRemindLater={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.notNowButtonLabel }));
    expect(onDismissPermanent).toHaveBeenCalledTimes(1);
  });

  it('fires onRemindLater when "Remind me in 2 weeks" is clicked', () => {
    const onRemindLater = vi.fn();
    render(
      <PwaInstallBanner
        labels={labels}
        platform="android"
        onInstallClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={onRemindLater}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.remindLaterButtonLabel }));
    expect(onRemindLater).toHaveBeenCalledTimes(1);
  });

  it('renders nothing extra beyond the three controls — no internal show/hide logic (a parent decides whether to render this component at all)', () => {
    const { container } = render(
      <PwaInstallBanner
        labels={labels}
        platform="android"
        onInstallClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });
});
