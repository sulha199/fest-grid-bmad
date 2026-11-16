import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capturePostHogEvent } from '@festgrid/analytics';
import { trackSubscriptionCapUpgradeClicked, trackSubscriptionCapUpgradeShown } from './subscription-cap-analytics';

vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));

const refusal = { activeCount: 3, reservedCount: 2, cap: 5 };

describe('subscription cap analytics', () => {
  beforeEach(() => vi.mocked(capturePostHogEvent).mockClear());

  it('sends the exact payloads, with accountId when known', () => {
    trackSubscriptionCapUpgradeShown({ refusal, surface: 'event_detail_source', accountId: '123' });
    trackSubscriptionCapUpgradeClicked({ refusal, surface: 'event_detail_source', accountId: '123' });
    expect(vi.mocked(capturePostHogEvent).mock.calls).toEqual([
      ['subscription_cap_upgrade_cta_shown', { currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'event_detail_source', accountId: '123' }],
      ['subscription_cap_upgrade_cta_clicked', { currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'event_detail_source', accountId: '123' }],
    ]);
  });

  it('omits accountId when it is unknown (a typed handle) and never adds a handle or name', () => {
    trackSubscriptionCapUpgradeShown({ refusal, surface: 'subscribe_dialog', handle: 'someone', displayName: 'Some One' } as never);
    const [, props] = vi.mocked(capturePostHogEvent).mock.calls[0]!;
    expect(props).toEqual({ currentSubscriptionCount: 3, reservedCount: 2, cap: 5, surface: 'subscribe_dialog' });
    expect(Object.keys(props as object)).not.toContain('accountId');
  });
});
