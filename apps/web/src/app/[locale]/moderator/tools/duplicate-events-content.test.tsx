import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import enMessages from '../../../../../locales/en.json';
import { DuplicateEventsContent } from './duplicate-events-content';
import {
  useQuerySuggestedEventMatches,
  useResolveSuggestedEventMatchMutation,
  useUndoEventMergeMutation,
  SuggestedEventMatchAction,
} from './duplicate-events-hooks';
import { useRequireModerator } from '@/features/auth/use-require-moderator';

vi.mock('./duplicate-events-hooks');
vi.mock('@/features/auth/use-require-moderator');
// `toast` is a callable function with `.success`/`.error` statics (sonner's real shape) --
// `useSoftDeleteWithUndo` (real hook, not mocked) calls the bare function for the undo toast,
// while this component calls `.success`/`.error` directly for Reject/error paths.
vi.mock('sonner', () => {
  const toastFn: any = vi.fn();
  toastFn.success = vi.fn();
  toastFn.error = vi.fn();
  return { toast: toastFn };
});
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};

function makeSuggestion(overrides: Partial<any> = {}) {
  return {
    id: 'suggestion-1',
    score: 0.6,
    status: 'pending',
    event: {
      id: 'event-new',
      slug: 'new-event',
      eventName: 'New Extraction Event',
      location: 'Jakarta',
      imageUrl: null,
      durableImageUrl: null,
      schedules: [{ id: 'sched-new', isMainSchedule: true, eventStartDate: '2026-12-01', eventEndDate: null, eventStartTime: null, eventEndTime: null, timezone: null }],
    },
    candidateEvent: {
      id: 'event-existing',
      slug: 'existing-event',
      eventName: 'Existing Event',
      location: 'Jakarta',
      imageUrl: null,
      durableImageUrl: null,
      schedules: [{ id: 'sched-existing', isMainSchedule: true, eventStartDate: '2026-12-01', eventEndDate: null, eventStartTime: null, eventEndTime: null, timezone: null }],
    },
    ...overrides,
  };
}

describe('DuplicateEventsContent', () => {
  let mockResolve: any;
  let mockUndo: any;
  let mockRefetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch = vi.fn();
    mockResolve = vi.fn().mockResolvedValue({ mergeId: 'merge-1', suggestion: { id: 'suggestion-1', status: 'accepted' } });
    mockUndo = vi.fn().mockResolvedValue({ id: 'event-new' });
    (useResolveSuggestedEventMatchMutation as any).mockReturnValue({ mutateAsync: mockResolve, isPending: false });
    (useUndoEventMergeMutation as any).mockReturnValue({ mutateAsync: mockUndo, isPending: false });
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading/auth states', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'unauthorized' });
    (useQuerySuggestedEventMatches as any).mockReturnValue({ data: null, isLoading: false, error: null, refetch: mockRefetch });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });
    expect(screen.queryByText('Existing Event')).not.toBeInTheDocument();
  });

  it('renders empty state', () => {
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('No duplicate suggestions')).toBeInTheDocument();
  });

  it('renders a suggestion row showing both the candidate and the new-extraction event', () => {
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: makeSuggestion(), cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('Existing Event')).toBeInTheDocument();
    expect(screen.getByText('New Extraction Event')).toBeInTheDocument();
    expect(screen.getByText('Existing event')).toBeInTheDocument();
    expect(screen.getByText('New extraction')).toBeInTheDocument();
  });

  it('Accept opens the confirmation dialog; confirming commits the merge and shows the undo toast', async () => {
    const user = userEvent.setup();
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: makeSuggestion(), cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());

    // Confirm is the dialog's own button, distinct from the row's Accept trigger.
    await user.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith({ id: 'suggestion-1', action: SuggestedEventMatchAction.Accept }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    // The undo toast (useSoftDeleteWithUndo's own bare `toast()` call) only fires once the
    // dialog has closed (AC6/AC7) -- no <Toaster/> is mounted in this test, so assert on the
    // mocked `toast` call itself rather than rendered DOM.
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Events merged', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }))
    );
  });

  it('Reject commits directly with no confirmation dialog', async () => {
    const user = userEvent.setup();
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: makeSuggestion(), cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith({ id: 'suggestion-1', action: SuggestedEventMatchAction.Reject }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suggestion dismissed'));
  });

  it('Undo (via the toast action) reverses the merge', async () => {
    const user = userEvent.setup();
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: makeSuggestion(), cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Events merged', expect.anything()));

    // No <Toaster/> is mounted in this test, so there is no rendered "Undo" button to click --
    // invoke the exact onClick the component handed to `toast(...)`'s `action`, matching what a
    // real click on the toast's own Undo action would trigger.
    const [, toastOptions] = (toast as any).mock.calls.find(([message]: [string]) => message === 'Events merged');
    toastOptions.action.onClick();

    await waitFor(() => expect(mockUndo).toHaveBeenCalledWith({ mergeId: 'merge-1' }));
  });
});
