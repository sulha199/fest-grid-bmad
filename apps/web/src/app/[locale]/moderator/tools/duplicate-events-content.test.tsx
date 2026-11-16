import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import enMessages from '../../../../../locales/en.json';
import idMessages from '../../../../../locales/id.json';
import { DEDUP_DECISION_CLUES } from '@festgrid/domain/events';
import { DuplicateEventsContent } from './duplicate-events-content';
import { CLUE_ASPECTS, CLUE_REASONS, dayGap } from './resolution-clue-checklist';
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
const capture = vi.hoisted(() => vi.fn());
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture }) }));

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

describe('clue labels', () => {
  it('every clue code of the domain list has a label in English and in Indonesian, and the locales hold no stale code', () => {
    for (const messages of [enMessages, idMessages] as any[]) {
      const labels = messages.DuplicateEventsPage.clues as Record<string, string>;
      expect(Object.keys(labels).sort()).toEqual([...DEDUP_DECISION_CLUES].sort());
      for (const code of DEDUP_DECISION_CLUES) expect(labels[code].trim()).not.toBe('');
      const shortLabels = messages.DuplicateEventsPage.clueShort as Record<string, string>;
      expect(Object.keys(shortLabels).sort()).toEqual(CLUE_ASPECTS.flatMap((aspect) => [...aspect.codes]).sort());
      expect(Object.keys(messages.DuplicateEventsPage.clueAspects).sort()).toEqual(CLUE_ASPECTS.map((aspect) => aspect.key).sort());
    }
  });
});

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

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith({ id: 'suggestion-1', action: SuggestedEventMatchAction.Accept, clues: null, note: null }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    // The undo toast (useSoftDeleteWithUndo's own bare `toast()` call) only fires once the
    // dialog has closed (AC6/AC7) -- no <Toaster/> is mounted in this test, so assert on the
    // mocked `toast` call itself rather than rendered DOM.
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Events merged', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }))
    );
  });

  const oneSuggestion = () =>
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: makeSuggestion(), cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

  it('Reject opens the dialog, warns it cannot be undone, and with no clue and no note commits null for both', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    expect(screen.getByText(/cannot be undone in the app/)).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith({ id: 'suggestion-1', action: SuggestedEventMatchAction.Reject, clues: null, note: null }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suggestion dismissed'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('Reject sends the ticked clues and the trimmed note', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(await screen.findByLabelText('Different organizer'));
    await user.click(screen.getByLabelText('Not an event, or a bad extraction'));
    await user.type(screen.getByLabelText(/Note \(optional/), '  kids run, not 10K  ');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith({
        id: 'suggestion-1',
        action: SuggestedEventMatchAction.Reject,
        clues: ['different-organizer', 'not-an-event'],
        note: 'kids run, not 10K',
      })
    );
    // Analytics carries the codes, never the note.
    await waitFor(() => expect(capture).toHaveBeenCalledWith('moderator_suggested_event_match_rejected', { suggestionId: 'suggestion-1', clues: ['different-organizer', 'not-an-event'] }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain('kids run');
  });

  it('Accept sends the ticked clues too', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await user.click(await screen.findByLabelText('Same venue'));
    await user.click(screen.getByLabelText('Shared link'));
    await user.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith({ id: 'suggestion-1', action: SuggestedEventMatchAction.Accept, clues: ['same-venue', 'shared-link'], note: null })
    );
  });

  it('an aspect is one row of toggles: choosing another answer replaces it, a second click clears it, other rows are untouched', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const same = await screen.findByRole('button', { name: 'Same venue' });
    const different = screen.getByRole('button', { name: 'Different venue' });
    expect(same).toHaveAttribute('aria-pressed', 'false');
    await user.click(same);
    expect(same).toHaveAttribute('aria-pressed', 'true');
    expect(different).not.toBeDisabled();
    await user.click(different);
    expect(same).toHaveAttribute('aria-pressed', 'false');
    expect(different).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Different organizer' }));
    expect(different).toHaveAttribute('aria-pressed', 'true');
    await user.click(different);
    expect(different).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Different organizer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Another reason')).not.toBeDisabled();
  });

  it('each aspect shows the two events\' own values: venue, dates with the day gap, and names', async () => {
    const user = userEvent.setup();
    const suggestion = makeSuggestion();
    suggestion.candidateEvent.location = 'Jalan Pramuka';
    suggestion.event.location = 'Jalan Pahlawan';
    suggestion.event.schedules[0].eventStartDate = '2026-12-03';
    (useQuerySuggestedEventMatches as any).mockReturnValue({
      data: { suggestedEventMatches: { edges: [{ node: suggestion, cursor: 'c1' }], pageInfo: { hasNextPage: false, endCursor: null } } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await screen.findByRole('alertdialog');
    expect(screen.getByText('Existing: Jalan Pramuka · New: Jalan Pahlawan')).toBeInTheDocument();
    expect(screen.getByText('Existing: 2026-12-01 · New: 2026-12-03 (2 days apart)')).toBeInTheDocument();
    expect(screen.getByText('Existing: Existing Event · New: New Extraction Event')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Venue' })).getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: 'Date' })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: 'Name' })).getAllByRole('button')).toHaveLength(3);
  });

  it('the other reasons start with what suits the decision: reject reasons on a reject, merge reasons on an accept', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });
    const reasonLabels = () => within(screen.getByRole('alertdialog')).getAllByRole('checkbox').map((box) => box.closest('label')?.textContent);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await screen.findByRole('alertdialog');
    expect(reasonLabels()[0]).toBe('Recurring series, not the same occurrence');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await screen.findByRole('alertdialog');
    expect(reasonLabels()[0]).toBe('Shared link');
  });

  it('the aspects and the other reasons together are exactly the domain list, each code once, for both decisions', () => {
    const aspectCodes = CLUE_ASPECTS.flatMap((aspect) => [...aspect.codes]);
    for (const decision of ['accept', 'reject'] as const) {
      const all = [...aspectCodes, ...CLUE_REASONS[decision]];
      expect(new Set(all).size).toBe(all.length);
      expect([...all].sort()).toEqual([...DEDUP_DECISION_CLUES].sort());
    }
  });

  it('dayGap counts whole days and says nothing for a missing or unreadable date', () => {
    expect(dayGap('2026-12-01', '2026-12-03')).toBe(2);
    expect(dayGap('2026-12-03', '2026-12-01')).toBe(2);
    expect(dayGap('2026-12-01', '2026-12-01')).toBe(0);
    expect(dayGap('2026-12-01', null)).toBeNull();
    expect(dayGap(undefined, '2026-12-01')).toBeNull();
    expect(dayGap('2026-12-01', 'soon')).toBeNull();
  });

  it('the checklist and the note start empty each time the dialog opens, and Cancel resolves nothing', async () => {
    const user = userEvent.setup();
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(await screen.findByLabelText('Same date'));
    await user.type(screen.getByLabelText(/Note \(optional/), 'draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockResolve).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('button', { name: 'Same date' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText(/Note \(optional/)).toHaveValue('');
  });

  it('the note is capped at 200 characters and counted, and never reaches analytics or the console', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockResolve.mockRejectedValueOnce(new Error('boom'));
    oneSuggestion();
    render(<DuplicateEventsContent />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const box = await screen.findByLabelText(/Note \(optional/);
    expect(box).toHaveAttribute('maxlength', '200');
    fireEvent.change(box, { target: { value: 'SECRET-NOTE' } });
    expect(screen.getByText('11/200')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to dismiss this suggestion'));
    const everythingPrinted = JSON.stringify([consoleError.mock.calls.map((call) => call.map(String)), (toast.error as any).mock.calls, (toast.success as any).mock.calls, capture.mock.calls]);
    expect(everythingPrinted).not.toContain('SECRET-NOTE');
    consoleError.mockRestore();
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

  // Story 0.i5c / AD-18: previous-page navigation and a page readout. This queue has no filters and
  // its connection reports no totalCount, so the readout is "Page N" with no total.
  describe('pagination', () => {
    const pages: Record<string, { id: string; hasNextPage: boolean; endCursor: string | null }> = {
      first: { id: 'suggestion-page-one', hasNextPage: true, endCursor: 'c1' },
      c1: { id: 'suggestion-page-two', hasNextPage: false, endCursor: null },
    };

    beforeEach(() => {
      (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
      (useQuerySuggestedEventMatches as any).mockImplementation((_size: number, cursor: string | undefined) => {
        const page = pages[cursor ?? 'first'];
        return {
          data: {
            suggestedEventMatches: {
              edges: [{
                node: makeSuggestion({ id: page.id, candidateEvent: { ...makeSuggestion().candidateEvent, eventName: `Event on ${page.id}` } }),
                cursor: page.endCursor ?? 'last',
              }],
              pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
            },
          },
          isLoading: false, error: null, refetch: mockRefetch,
        };
      });
    });

    const lastCursor = () => {
      const calls = (useQuerySuggestedEventMatches as any).mock.calls;
      return calls[calls.length - 1][1] as string | undefined;
    };

    it('shows the page number without a total, with Previous disabled on the first page', () => {
      render(<DuplicateEventsContent />, { wrapper: createWrapper() });
      expect(screen.getByText('Event on suggestion-page-one')).toBeInTheDocument();
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.queryByText(/total/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('goes forward to the last page and back, fetching each page with its own cursor', () => {
      render(<DuplicateEventsContent />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(lastCursor()).toBe('c1');
      expect(screen.getByText('Event on suggestion-page-two')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(lastCursor()).toBeUndefined();
      expect(screen.getByText('Event on suggestion-page-one')).toBeInTheDocument();
    });
  });
});
