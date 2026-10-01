/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AmbientLocationBanner } from './AmbientLocationBanner';

const labels = {
  message: 'Enable your location to see nearby distances.',
  enableButtonLabel: 'Enable nearby distances',
  notNowButtonLabel: 'Not now',
  remindLaterButtonLabel: 'Remind me in 2 weeks',
};

describe('AmbientLocationBanner (Story 0.39 AC6-AC8)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the message and all three controls in order: primary action, "Not now", "Remind me in 2 weeks"', () => {
    render(
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    expect(screen.getByText(labels.message)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      labels.enableButtonLabel,
      labels.notNowButtonLabel,
      labels.remindLaterButtonLabel,
    ]);
  });

  it('fires onEnableClick when the primary action is clicked', () => {
    const onEnableClick = vi.fn();
    render(
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={onEnableClick}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.enableButtonLabel }));
    expect(onEnableClick).toHaveBeenCalledTimes(1);
  });

  it('fires onDismissPermanent when "Not now" is clicked', () => {
    const onDismissPermanent = vi.fn();
    render(
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={vi.fn()}
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
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={onRemindLater}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: labels.remindLaterButtonLabel }));
    expect(onRemindLater).toHaveBeenCalledTimes(1);
  });

  it('disables the primary action while isPending is true', () => {
    render(
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
        isPending
      />
    );

    expect(screen.getByRole('button', { name: labels.enableButtonLabel })).toBeDisabled();
  });

  it('the primary action is enabled by default (isPending omitted)', () => {
    render(
      <AmbientLocationBanner
        labels={labels}
        onEnableClick={vi.fn()}
        onDismissPermanent={vi.fn()}
        onRemindLater={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: labels.enableButtonLabel })).toBeEnabled();
  });
});
