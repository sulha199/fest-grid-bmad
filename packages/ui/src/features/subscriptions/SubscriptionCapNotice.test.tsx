import * as React from 'react';
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriptionCapNotice } from './SubscriptionCapNotice';
import type { SubscriptionCapNoticeLabels } from './SubscriptionCapNotice.types';

const labels: SubscriptionCapNoticeLabels = {
  title: 'You have reached your limit',
  body: 'You have 3 accounts added and 2 more being added. The limit is 5.',
  hint: 'Remove an account to make room.',
  blockedNote: 'Adding another account is paused.',
  upgradeButton: 'Upgrade',
  comingSoonBadge: 'Coming soon',
  comingSoonNote: 'Paid plans are not available yet.',
  afterClickNote: 'Thanks for your interest.',
  manageLink: 'Manage subscribed accounts',
  announce: 'Limit reached. You have 3 accounts added and 2 more being added. The limit is 5.',
};
const refusal = { activeCount: 3, reservedCount: 2, cap: 5 };

describe('SubscriptionCapNotice', () => {
  afterEach(cleanup);

  it('inline: status region, focus on the title, body and Upgrade child shown', () => {
    render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" />);
    expect(screen.getByRole('status')).toHaveTextContent(labels.announce);
    const title = screen.getByTestId('subscription-cap-title');
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent(labels.body);
    expect(screen.getByRole('button', { name: /Upgrade/ })).toBeEnabled();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('dialog: no status region, no title, no focus grab', () => {
    render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="dialog" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('subscription-cap-title')).toBeNull();
    expect(document.body).toHaveFocus();
    expect(screen.getByTestId('subscription-cap-body')).toBeInTheDocument();
  });

  it('carries the counts, including a user above the cap (7 of 5)', () => {
    render(<SubscriptionCapNotice refusal={{ activeCount: 7, reservedCount: 0, cap: 5 }} labels={{ ...labels, body: 'You have 7 accounts added. The limit is 5.' }} variant="inline" />);
    const box = screen.getByTestId('subscription-cap-notice');
    expect(box).toHaveAttribute('data-active-count', '7');
    expect(box).toHaveAttribute('data-cap', '5');
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent('7 accounts added');
  });

  it('shows the blocked note only when asked', () => {
    const { rerender } = render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" />);
    expect(screen.queryByTestId('subscription-cap-blocked-note')).toBeNull();
    rerender(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" showBlockedNote />);
    expect(screen.getByTestId('subscription-cap-blocked-note')).toBeInTheDocument();
  });

  it('renders the manage link only when an href is given, and through renderLink when supplied', () => {
    const { rerender } = render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" />);
    expect(screen.queryByText('Manage subscribed accounts')).toBeNull();
    rerender(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" manageHref="/settings/account" />);
    expect(screen.getByRole('link', { name: 'Manage subscribed accounts' })).toHaveAttribute('href', '/settings/account');
    rerender(
      <SubscriptionCapNotice
        refusal={refusal}
        labels={labels}
        variant="inline"
        manageHref="/x"
        renderLink={({ href, className, children }) => (
          <a href={href} className={className} data-custom="1">
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('data-custom', '1');
  });

  it('wires the Upgrade callbacks', async () => {
    const onUpgradeShown = vi.fn();
    const onUpgradeClick = vi.fn();
    render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" onUpgradeShown={onUpgradeShown} onUpgradeClick={onUpgradeClick} />);
    expect(onUpgradeShown).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /Upgrade/ }));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Thanks for your interest.')).toBeInTheDocument();
  });

  it('is amber (not red) and wraps', () => {
    render(<SubscriptionCapNotice refusal={refusal} labels={labels} variant="inline" />);
    const cls = screen.getByTestId('subscription-cap-notice').className;
    expect(cls).toContain('amber');
    expect(cls).not.toContain('red');
    expect(cls).toContain('min-w-0');
  });

  it('never imports next-intl or analytics (props-driven)', () => {
    for (const f of ['SubscriptionCapNotice.tsx', '../../core/upgrade-cta.tsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src).not.toMatch(/next-intl|@festgrid\/analytics/);
    }
  });
});
