import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from './job-test-support';
import { useActiveJobs, useJob, useMyJobs } from './use-jobs';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const wrapper = ({ children }: { children: React.ReactNode }) => <TestProviders>{children}</TestProviders>;
const count = (log: Array<{ operation: string }>, op: string) => log.filter((l) => l.operation === op).length;
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  request.mockReset();
});

describe('useJob polling', () => {
  it('polls every 2 s for a dialog and every 5 s for a chip', async () => {
    const log = installGraphqlFake(request, () => ({ job: makeFragment() }));
    const dialog = renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(0);
    expect(dialog.result.current.state).toBe('ready');
    expect(count(log, 'JobById')).toBe(1);
    await tick(2000);
    expect(count(log, 'JobById')).toBe(2);
    await tick(4000);
    expect(count(log, 'JobById')).toBe(4);
    dialog.unmount();

    const chipLog = installGraphqlFake(request, () => ({ job: makeFragment() }));
    renderHook(() => useJob('job-1', { surface: 'chip' }), { wrapper });
    await tick(0);
    await tick(4900);
    expect(count(chipLog, 'JobById')).toBe(1);
    await tick(200);
    expect(count(chipLog, 'JobById')).toBe(2);
  });

  it('stops polling once the job ended, and when it is not found', async () => {
    let status = 'RUNNING';
    const log = installGraphqlFake(request, () => ({ job: makeFragment({ status }) }));
    const { result } = renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(0);
    status = 'SUCCEEDED';
    await tick(2000);
    await tick(10);
    expect(result.current.job?.status).toBe('SUCCEEDED');
    const after = count(log, 'JobById');
    await tick(20_000);
    expect(count(log, 'JobById')).toBe(after);

    const gone = installGraphqlFake(request, () => ({ job: null }));
    const missing = renderHook(() => useJob('nope', { surface: 'dialog' }), { wrapper });
    await tick(0);
    expect(missing.result.current.state).toBe('not-found');
    await tick(20_000);
    expect(count(gone, 'JobById')).toBe(1);
  });

  it('pauses while the tab is hidden and fetches once, at once, on return', async () => {
    const log = installGraphqlFake(request, () => ({ job: makeFragment() }));
    renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(0);
    expect(count(log, 'JobById')).toBe(1);
    act(() => setVisibility('hidden'));
    await tick(30_000);
    expect(count(log, 'JobById')).toBe(1);
    act(() => setVisibility('visible'));
    await tick(0);
    expect(count(log, 'JobById')).toBe(2);
  });

  it('doubles the interval after errors up to 30 s, keeps the last state and reports "reconnecting"', async () => {
    let fail = false;
    const log = installGraphqlFake(request, () => {
      if (fail) throw new Error('offline');
      return { job: makeFragment() };
    });
    const { result } = renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(0);
    fail = true;
    await tick(2000); // fails: 1st error, next in 4 s
    await tick(10);
    expect(count(log, 'JobById')).toBe(2);
    expect(result.current.reconnecting).toBe(true);
    expect(result.current.job?.id).toBe('job-1');
    await tick(3900);
    expect(count(log, 'JobById')).toBe(2);
    await tick(200); // 3rd request; failing again: next in 8 s
    expect(count(log, 'JobById')).toBe(3);
    await tick(7800);
    expect(count(log, 'JobById')).toBe(3);
    await tick(200);
    expect(count(log, 'JobById')).toBe(4);
    await tick(16_100);
    expect(count(log, 'JobById')).toBe(5);
    await tick(30_100);
    expect(count(log, 'JobById')).toBe(6);
    fail = false;
    await tick(30_100);
    expect(result.current.reconnecting).toBe(false);
  });

  it('a first load that fails reads as an error, and polling goes on with back-off', async () => {
    const log = installGraphqlFake(request, () => {
      throw new Error('down');
    });
    const { result } = renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(0);
    expect(result.current.state).toBe('error');
    await tick(4100);
    expect(count(log, 'JobById')).toBeGreaterThanOrEqual(2);
  });

  it('never touches localStorage or sessionStorage', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    installGraphqlFake(request, () => ({ job: makeFragment() }));
    renderHook(() => useJob('job-1', { surface: 'dialog' }), { wrapper });
    await tick(5000);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('is idle and fetches nothing without an id', async () => {
    const log = installGraphqlFake(request, () => ({ job: null }));
    const { result } = renderHook(() => useJob(null), { wrapper });
    await tick(5000);
    expect(result.current.state).toBe('idle');
    expect(log).toHaveLength(0);
  });
});

describe('useActiveJobs', () => {
  it('sends the subject and window, polls at 5 s only while a returned job is open, and not at all when none is', async () => {
    const log = installGraphqlFake(request, () => ({ activeJobs: [{ ...makeFragment(), owner: null }] }));
    const { result, unmount } = renderHook(() => useActiveJobs({ subject: { type: 'REEXTRACT_REFRESH' as never, postId: 'p1' }, endedWithinMinutes: 30 }), { wrapper });
    await tick(0);
    expect(log[0].variables).toMatchObject({ subject: { postId: 'p1' }, endedWithinMinutes: 30 });
    expect(result.current.jobs[0]).toMatchObject({ id: 'job-1', subject: { postCode: 'DcntzF0mB7z' } });
    await tick(5100);
    expect(count(log, 'ActiveJobs')).toBe(2);

    unmount();
    const empty = installGraphqlFake(request, () => ({ activeJobs: [] }));
    renderHook(() => useActiveJobs({}), { wrapper });
    await tick(60_000);
    expect(count(empty, 'ActiveJobs')).toBe(1);
  });

  it('poll=false reads once, even with an open job', async () => {
    const log = installGraphqlFake(request, () => ({ activeJobs: [{ ...makeFragment(), owner: null }] }));
    renderHook(() => useActiveJobs({ poll: false }), { wrapper });
    await tick(30_000);
    expect(count(log, 'ActiveJobs')).toBe(1);
  });
});

describe('useMyJobs', () => {
  const page = (status: string) => ({ myJobs: { edges: [{ cursor: 'c1', node: { ...makeFragment({ status }), owner: null } }], pageInfo: { hasNextPage: false, endCursor: null } } });

  it('passes the cursor, polls at 10 s while the page holds an open job, never when all ended', async () => {
    const open = installGraphqlFake(request, () => page('RUNNING'));
    const first = renderHook(() => useMyJobs({ onlyEnded: false, after: 'abc' }), { wrapper });
    await tick(0);
    expect(open[0].variables).toMatchObject({ after: 'abc', first: 20, onlyEnded: false });
    await tick(9900);
    expect(count(open, 'MyJobs')).toBe(1);
    await tick(200);
    expect(count(open, 'MyJobs')).toBe(2);

    first.unmount();
    const ended = installGraphqlFake(request, () => page('SUCCEEDED'));
    renderHook(() => useMyJobs({ onlyEnded: true }), { wrapper });
    await tick(60_000);
    expect(count(ended, 'MyJobs')).toBe(1);
  });
});
