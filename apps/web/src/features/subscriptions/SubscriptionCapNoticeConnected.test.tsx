import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { capturePostHogEvent } from '@festgrid/analytics';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';
import { SubscriptionCapNoticeConnected } from './SubscriptionCapNoticeConnected';
import { SubscriptionCapDialog } from './SubscriptionCapDialog';
import type { SubscriptionCapState } from './use-subscription-cap-refusal';

vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const capture = vi.mocked(capturePostHogEvent);
const state = (over: Partial<SubscriptionCapState> = {}): SubscriptionCapState => ({ refusal: { activeCount: 3, reservedCount: 2, cap: 5 }, surface: 'subscribe_dialog', refusalId: 1, ...over });
const wrap = (ui: React.ReactNode, locale: 'en' | 'id' = 'en') => (
  <NextIntlClientProvider locale={locale} messages={(locale === 'en' ? en : id) as never}>
    {ui}
  </NextIntlClientProvider>
);

describe('SubscriptionCapNoticeConnected', () => {
  beforeEach(() => capture.mockClear());
  afterEach(cleanup);

  it.each([
    [{ activeCount: 5, reservedCount: 0, cap: 5 }, 'You have 5 accounts added. The limit is 5.'],
    [{ activeCount: 4, reservedCount: 1, cap: 5 }, 'You have 4 accounts added and 1 more being added. The limit is 5.'],
    [{ activeCount: 3, reservedCount: 2, cap: 5 }, 'You have 3 accounts added and 2 more being added. The limit is 5.'],
    [{ activeCount: 7, reservedCount: 0, cap: 5 }, 'You have 7 accounts added. The limit is 5.'],
  ])('English body for %j', (refusal, text) => {
    render(wrap(<SubscriptionCapNoticeConnected state={state({ refusal })} variant="inline" />));
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent(text);
    expect(screen.getByRole('status')).toHaveTextContent(`Limit reached. ${text}`);
  });

  it('Indonesian copy, with "Tingkatkan" and the Indonesian note', () => {
    render(wrap(<SubscriptionCapNoticeConnected state={state()} variant="inline" showBlockedNote />, 'id'));
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent('Anda memiliki 3 akun yang sudah ditambahkan dan 2 lagi sedang ditambahkan. Batasnya 5.');
    expect(screen.getByRole('button', { name: /Tingkatkan/ })).toBeEnabled();
    expect(screen.getByText('Segera hadir')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-cap-blocked-note')).toBeInTheDocument();
  });

  it('fires shown once per refusal (not per re-render), and clicked on every click, with the exact properties', async () => {
    const { rerender } = render(wrap(<SubscriptionCapNoticeConnected state={state({ accountId: '77' })} variant="inline" />));
    rerender(wrap(<SubscriptionCapNoticeConnected state={state({ accountId: '77' })} variant="inline" />));
    expect(capture.mock.calls).toEqual([['subscription_cap_upgrade_cta_shown', { currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'subscribe_dialog', accountId: '77' }]]);
    await userEvent.click(screen.getByRole('button', { name: /Upgrade/ }));
    await userEvent.click(screen.getByRole('button', { name: /Upgrade/ }));
    expect(capture.mock.calls.filter(([n]) => n === 'subscription_cap_upgrade_cta_clicked')).toHaveLength(2);
    expect(capture).toHaveBeenLastCalledWith('subscription_cap_upgrade_cta_clicked', { currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'subscribe_dialog', accountId: '77' });
    // A new refusal (new id) is a new showing, in place.
    rerender(wrap(<SubscriptionCapNoticeConnected state={state({ accountId: '77', refusalId: 2, refusal: { activeCount: 4, reservedCount: 1, cap: 5 } })} variant="inline" />));
    expect(capture.mock.calls.filter(([n]) => n === 'subscription_cap_upgrade_cta_shown')).toHaveLength(2);
  });

  it('wizard layout (stands in for a 320 px check, the wizard step is not reachable in the overflow matrix): the longest Indonesian body wraps and the Upgrade button is full width below sm', () => {
    render(wrap(<SubscriptionCapNoticeConnected state={state({ refusal: { activeCount: 12, reservedCount: 12, cap: 5 } })} variant="inline" showBlockedNote />, 'id'));
    const box = screen.getByTestId('subscription-cap-notice');
    expect(box.className).toMatch(/min-w-0/);
    expect(box.className).toMatch(/break-words/);
    expect(box.className).not.toMatch(/whitespace-nowrap|truncate/);
    const upgrade = screen.getByRole('button', { name: /Tingkatkan/ });
    expect(upgrade.className).toMatch(/\bw-full\b/);
    expect(upgrade.className).toMatch(/sm:w-auto/);
    expect(upgrade.className).toMatch(/whitespace-normal/);
    expect(upgrade.className).toMatch(/min-h-11/);
  });

  it('omits accountId from both events when unknown', async () => {
    render(wrap(<SubscriptionCapNoticeConnected state={state()} variant="inline" />));
    await userEvent.click(screen.getByRole('button', { name: /Upgrade/ }));
    for (const [, props] of capture.mock.calls) expect(Object.keys(props as object)).not.toContain('accountId');
  });

  it('shows the manage link only when asked', () => {
    const { rerender } = render(wrap(<SubscriptionCapNoticeConnected state={state()} variant="inline" />));
    expect(screen.queryByRole('link')).toBeNull();
    rerender(wrap(<SubscriptionCapNoticeConnected state={state()} variant="inline" showManageLink />));
    expect(screen.getByRole('link', { name: 'Manage subscribed accounts' })).toHaveAttribute('href', '/settings/account');
  });
});

describe('SubscriptionCapDialog', () => {
  beforeEach(() => capture.mockClear());
  afterEach(cleanup);

  it('is closed with no refusal and opens with the title focused, the notice, a manage link and Close', () => {
    const onClose = vi.fn();
    const { rerender } = render(wrap(<SubscriptionCapDialog state={null} onClose={onClose} />));
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(wrap(<SubscriptionCapDialog state={state({ surface: 'restore' })} onClose={onClose} />));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('You have reached your limit');
    expect(screen.getByRole('heading', { name: 'You have reached your limit' })).toHaveFocus();
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent('You have 3 accounts added and 2 more being added. The limit is 5.');
    expect(screen.getByRole('link', { name: 'Manage subscribed accounts' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(capture).toHaveBeenCalledWith('subscription_cap_upgrade_cta_shown', expect.objectContaining({ surface: 'restore' }));
  });

  it('Close and Escape call onClose', async () => {
    const onClose = vi.fn();
    render(wrap(<SubscriptionCapDialog state={state()} onClose={onClose} />));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    onClose.mockClear();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
