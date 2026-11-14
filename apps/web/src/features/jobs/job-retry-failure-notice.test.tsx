import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { capturePostHogEvent } from '@festgrid/analytics';
import { JobRetryFailureNotice } from './job-retry-failure-notice';
import { TestProviders } from './job-test-support';

vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const capture = vi.mocked(capturePostHogEvent);
const cap = (activeCount: number) => ({ kind: 'cap' as const, activeCount, reservedCount: 0, cap: 5 });
const shown = () => capture.mock.calls.filter(([name]) => name === 'subscription_cap_upgrade_cta_shown');

describe('JobRetryFailureNotice cap refusal', () => {
  beforeEach(() => capture.mockClear());
  afterEach(cleanup);

  it('a second refused Retry while the notice is mounted is a new showing: a new shown event, the new numbers and focus on the title again', () => {
    const { rerender } = render(<TestProviders><JobRetryFailureNotice failure={cap(5)} /></TestProviders>);
    expect(shown()).toHaveLength(1);
    expect(screen.getByTestId('subscription-cap-title')).toHaveFocus();
    (document.activeElement as HTMLElement).blur();

    rerender(<TestProviders><JobRetryFailureNotice failure={cap(7)} /></TestProviders>);
    expect(shown()).toHaveLength(2);
    expect(shown()[1]![1]).toMatchObject({ currentSubscriptionCount: 7, surface: 'job_retry' });
    expect(screen.getByTestId('subscription-cap-body')).toHaveTextContent('You have 7 accounts added');
    expect(screen.getByTestId('subscription-cap-title')).toHaveFocus();
  });

  it('a re-render with the same failure is not a new showing', () => {
    const failure = cap(5);
    const { rerender } = render(<TestProviders><JobRetryFailureNotice failure={failure} /></TestProviders>);
    rerender(<TestProviders><JobRetryFailureNotice failure={failure} /></TestProviders>);
    expect(shown()).toHaveLength(1);
  });
});
