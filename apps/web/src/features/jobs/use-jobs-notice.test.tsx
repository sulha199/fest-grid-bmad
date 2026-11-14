import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, setVisibility } from './job-test-support';
import { resetAcknowledgedJobs, useAcknowledgeEndedJobs, useJobsFinishedCount, useMarkJobsOpened } from './use-jobs-notice';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const count = (log: Array<{ operation: string }>, op: string) => log.filter((l) => l.operation === op).length;
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  cleanup();
  await resetAcknowledgedJobs();
  vi.useRealTimers();
  request.mockReset();
});

describe('useJobsFinishedCount', () => {
  it('returns the server count, and 0 when signed out (no request)', async () => {
    const log = installGraphqlFake(request, () => ({ jobsFinishedSinceLastOpened: 4 }));
    const off = renderHook(() => useJobsFinishedCount(false), { wrapper });
    await tick(0);
    expect(off.result.current).toBe(0);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(0);
    const on = renderHook(() => useJobsFinishedCount(true), { wrapper });
    await tick(0);
    expect(on.result.current).toBe(4);
  });

  it('shows no badge on a load error, never a wrong number', async () => {
    installGraphqlFake(request, () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useJobsFinishedCount(true), { wrapper });
    await tick(0);
    expect(result.current).toBe(0);
  });

  it('polls slowly (60 s), not while the tab is hidden, and fetches once on return', async () => {
    const log = installGraphqlFake(request, () => ({ jobsFinishedSinceLastOpened: 1 }));
    renderHook(() => useJobsFinishedCount(true), { wrapper });
    await tick(0);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(1);
    await tick(59_000);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(1);
    await tick(2000);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(2);
    act(() => setVisibility('hidden'));
    await tick(300_000);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(2);
    act(() => setVisibility('visible'));
    await tick(10);
    expect(count(log, 'jobsFinishedSinceLastOpened')).toBe(3);
  });
});

describe('useMarkJobsOpened', () => {
  it('calls the mutation and zeroes the cached count', async () => {
    const log = installGraphqlFake(request, (op) => (op === 'markJobsOpened' ? { markJobsOpened: true } : { jobsFinishedSinceLastOpened: 5 }));
    const { result } = renderHook(() => ({ n: useJobsFinishedCount(true), mark: useMarkJobsOpened() }), { wrapper });
    await tick(0);
    expect(result.current.n).toBe(5);
    act(() => result.current.mark());
    await tick(0);
    expect(count(log, 'markJobsOpened')).toBe(1);
    expect(result.current.n).toBe(0);
  });
});

describe('useAcknowledgeEndedJobs', () => {
  it('acknowledges an ended job once, never an open one', async () => {
    const log = installGraphqlFake(request, () => ({ acknowledgeJobEnded: true }));
    const { result } = renderHook(() => useAcknowledgeEndedJobs(), { wrapper });
    act(() => result.current([{ id: 'a', status: 'RUNNING' }, { id: 'b', status: 'QUEUED' }, { id: 'c', status: 'WAITING' }]));
    await tick(0);
    expect(count(log, 'acknowledgeJobEnded')).toBe(0);
    act(() => result.current([{ id: 'a', status: 'SUCCEEDED' }, { id: 'd', status: 'FAILED' }]));
    act(() => result.current([{ id: 'a', status: 'SUCCEEDED' }, { id: 'd', status: 'FAILED' }]));
    await tick(0);
    expect(log.filter((l) => l.operation === 'acknowledgeJobEnded').map((l) => l.variables.jobId)).toEqual(['a', 'd']);
  });

  it('never acknowledges from a hidden tab, and does once the tab is visible', async () => {
    const log = installGraphqlFake(request, () => ({ acknowledgeJobEnded: true }));
    const { result } = renderHook(() => useAcknowledgeEndedJobs(), { wrapper });
    act(() => setVisibility('hidden'));
    act(() => result.current([{ id: 'a', status: 'SUCCEEDED' }]));
    await tick(0);
    expect(count(log, 'acknowledgeJobEnded')).toBe(0);
    act(() => setVisibility('visible'));
    act(() => result.current([{ id: 'a', status: 'SUCCEEDED' }]));
    await tick(0);
    expect(count(log, 'acknowledgeJobEnded')).toBe(1);
  });

  it('tries a failed job again on the next call, every failure of a batch counts (not only the last), and gives up after 3 attempts', async () => {
    let failIds = new Set(['a', 'b', 'c']);
    const log = installGraphqlFake(request, (_op, variables) => {
      if (failIds.has(String(variables.jobId))) throw new Error('boom');
      return { acknowledgeJobEnded: true };
    });
    const { result } = renderHook(() => useAcknowledgeEndedJobs(), { wrapper });
    const jobs = [{ id: 'a', status: 'SUCCEEDED' }, { id: 'b', status: 'FAILED' }, { id: 'c', status: 'EXPIRED' }];
    act(() => result.current(jobs));
    await tick(0);
    expect(log).toHaveLength(3);
    // The failures of the first and the second job (not the last mutate call) were un-marked too: all three are offered again.
    failIds = new Set(['a']);
    act(() => result.current(jobs));
    await tick(0);
    expect(log.slice(3).map((l) => l.variables.jobId)).toEqual(['a', 'b', 'c']);
    act(() => result.current(jobs));
    await tick(0);
    expect(log.slice(6).map((l) => l.variables.jobId)).toEqual(['a']);
    act(() => result.current(jobs));
    await tick(0);
    expect(log).toHaveLength(7);
  });

  it('sends one request after the other, in order, never in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    installGraphqlFake(request, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { acknowledgeJobEnded: true };
    });
    const { result } = renderHook(() => useAcknowledgeEndedJobs(), { wrapper });
    act(() => result.current(['a', 'b', 'c', 'd'].map((id) => ({ id, status: 'SUCCEEDED' }))));
    await tick(100);
    expect(request).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBe(1);
  });
});
