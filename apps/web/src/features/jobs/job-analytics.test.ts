import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capturePostHogEvent } from '@festgrid/analytics';
import { trackJobProgressMinimized, trackJobProgressReopened, trackJobRetryClicked, trackJobsFilterChanged } from './job-analytics';

vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));

describe('job analytics', () => {
  beforeEach(() => vi.mocked(capturePostHogEvent).mockClear());
  it('sends exactly the four events with only the specified properties', () => {
    trackJobProgressMinimized({ jobType: 'REEXTRACT_REFRESH', status: 'RUNNING', extra: 'x' } as never);
    trackJobProgressReopened({ jobType: 'SUBSCRIBE', status: 'WAITING', source: 'chip' });
    trackJobRetryClicked({ jobType: 'SUBSCRIBE', reasonCode: 'TIMED_OUT' });
    trackJobsFilterChanged({ scope: 'ALL_USERS', includeSystem: true });
    expect(vi.mocked(capturePostHogEvent).mock.calls).toEqual([
      ['job_progress_minimized', { jobType: 'REEXTRACT_REFRESH', status: 'RUNNING' }],
      ['job_progress_reopened', { jobType: 'SUBSCRIBE', status: 'WAITING', source: 'chip' }],
      ['job_retry_clicked', { jobType: 'SUBSCRIBE', reasonCode: 'TIMED_OUT' }],
      ['jobs_filter_changed', { scope: 'ALL_USERS', includeSystem: true }],
    ]);
  });
});
