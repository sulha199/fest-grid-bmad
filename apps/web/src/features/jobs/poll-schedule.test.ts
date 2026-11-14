import { describe, expect, it } from 'vitest';
import { getJobPollInterval, getJobsBadgePollInterval, JOBS_BADGE_POLL_MS } from './poll-schedule';

const base = { hasOpenJob: true, consecutiveErrors: 0, hidden: false };

describe('getJobPollInterval', () => {
  it('uses 2 s for a dialog, 5 s for a chip and 10 s for a list', () => {
    expect(getJobPollInterval({ ...base, surface: 'dialog' })).toBe(2000);
    expect(getJobPollInterval({ ...base, surface: 'chip' })).toBe(5000);
    expect(getJobPollInterval({ ...base, surface: 'list' })).toBe(10_000);
  });
  it('does not poll when every job has ended', () => {
    expect(getJobPollInterval({ ...base, surface: 'dialog', hasOpenJob: false })).toBe(false);
  });
  it('does not poll while the tab is hidden', () => {
    expect(getJobPollInterval({ ...base, surface: 'dialog', hidden: true })).toBe(false);
  });
  it('doubles after each error and stops doubling at 30 s', () => {
    expect([1, 2, 3, 4, 5].map((n) => getJobPollInterval({ ...base, surface: 'dialog', consecutiveErrors: n }))).toEqual([4000, 8000, 16_000, 30_000, 30_000]);
    expect(getJobPollInterval({ ...base, surface: 'list', consecutiveErrors: 1 })).toBe(20_000);
    expect(getJobPollInterval({ ...base, surface: 'list', consecutiveErrors: 2 })).toBe(30_000);
  });
});

describe('getJobsBadgePollInterval (Story 10.13)', () => {
  it('polls slowly, not while hidden, and backs off up to 4 minutes', () => {
    expect(getJobsBadgePollInterval({ consecutiveErrors: 0, hidden: false })).toBe(JOBS_BADGE_POLL_MS);
    expect(getJobsBadgePollInterval({ consecutiveErrors: 0, hidden: true })).toBe(false);
    expect([1, 2, 3].map((n) => getJobsBadgePollInterval({ consecutiveErrors: n, hidden: false }))).toEqual([120_000, 240_000, 240_000]);
  });
});
