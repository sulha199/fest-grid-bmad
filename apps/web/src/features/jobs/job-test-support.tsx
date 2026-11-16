import React from 'react';
import { vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../locales/en.json';
import { JobAnnouncerProvider } from './job-announcer-provider';
import type { JobProgressFieldsFragment } from '@/generated/graphql';

export function makeFragment(overrides: Record<string, unknown> = {}): JobProgressFieldsFragment {
  return {
    id: 'job-1',
    type: 'REEXTRACT_REFRESH',
    trigger: 'USER',
    status: 'RUNNING',
    isCancelled: false,
    reasonCode: null,
    reasonRetryAfter: null,
    reasonQueueMaxWaitMinutes: null,
    createdAt: '2026-11-13T13:59:00.000Z',
    startedAt: '2026-11-13T14:00:00.000Z',
    finishedAt: null,
    deadlineAt: '2026-11-13T14:10:00.000Z',
    completedAfterDeadline: false,
    subject: { kind: 'POST', accountId: null, platform: null, username: null, displayName: null, profileImageUrl: null, postCount: null, postCode: 'DcntzF0mB7z', postId: 'p1' },
    steps: [
      { key: 'refresh', state: 'DONE', done: null, total: null },
      { key: 'preview', state: 'CURRENT', done: null, total: null },
    ],
    queue: null,
    waiting: null,
    outcome: null,
    canRetry: false,
    retryNotBefore: null,
    ...overrides,
  } as unknown as JobProgressFieldsFragment;
}

export type Handler = (operation: string, variables: Record<string, unknown>) => unknown;

/** Routes `graphqlClient.request` calls by operation name; a thrown value rejects. Returns the request log. */
export function installGraphqlFake(request: ReturnType<typeof vi.fn>, handler: Handler) {
  const log: Array<{ operation: string; variables: Record<string, unknown> }> = [];
  request.mockImplementation(async (arg: { document?: unknown; variables?: Record<string, unknown> } | string) => {
    const args = typeof arg === 'string' ? { document: arg, variables: {} } : arg;
    const doc = String(args.document ?? '');
    const operation = /(?:query|mutation)\s+(\w+)/.exec(doc)?.[1] ?? 'unknown';
    const variables = args.variables ?? {};
    log.push({ operation, variables });
    return handler(operation, variables);
  });
  return log;
}

export function TestProviders({ children, client }: { children: React.ReactNode; client?: QueryClient }) {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages as never} timeZone="UTC">
      <QueryClientProvider client={qc}>
        <JobAnnouncerProvider>{children}</JobAnnouncerProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}
