import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { UnprocessedPayloadsContent } from './unprocessed-payloads-content';
import {
  useUnprocessedPayloadsQuery,
  useReprocessPayloadMutation,
  useDeleteUnprocessedPayloadMutation,
} from './unprocessed-payloads-hooks';
import { useRequireModerator } from '@/features/auth/use-require-moderator';

vi.mock('./unprocessed-payloads-hooks');
vi.mock('@/features/auth/use-require-moderator');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

// The list row and the filter panel have their own tests; here they are stand-ins so the
// pagination wiring is what is under test.
vi.mock('./payload-list-item', () => ({
  PayloadListItem: ({ payload }: { payload: { id: string } }) => <div data-testid="payload-row">{payload.id}</div>,
}));
vi.mock('./filter-panel', () => ({
  FilterPanel: ({ onFilterChange, onClear }: { onFilterChange: (f: { source: string }) => void; onClear?: () => void }) => (
    <>
      <button onClick={() => onFilterChange({ source: 'APIFY' })}>pick source</button>
      <button onClick={() => onClear?.()}>clear filters</button>
    </>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={enMessages as never}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  };
};

const refetchSpy = vi.fn();

// Story 0.i5c / AD-18: three pages of 20 over 45 payloads; the cursor each page is fetched with picks the page.
const pages: Record<string, { id: string; hasNextPage: boolean; endCursor: string | null }> = {
  first: { id: 'payload-on-page-one', hasNextPage: true, endCursor: 'c1' },
  c1: { id: 'payload-on-page-two', hasNextPage: true, endCursor: 'c2' },
  c2: { id: 'payload-on-page-three', hasNextPage: false, endCursor: null },
};

describe('UnprocessedPayloadsContent pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRequireModerator).mockReturnValue({ status: 'authorized' } as never);
    vi.mocked(useReprocessPayloadMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDeleteUnprocessedPayloadMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useUnprocessedPayloadsQuery).mockImplementation(((_filters: unknown, cursor: string | undefined) => {
      const page = pages[cursor ?? 'first'];
      return {
        data: {
          queryUnprocessedPayloads: {
            edges: [{ node: { id: page.id }, cursor: page.endCursor ?? 'last' }],
            pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
            totalCount: 45,
          },
        },
        isLoading: false, error: null, refetch: refetchSpy,
      };
    }) as never);
  });

  afterEach(() => {
    cleanup();
  });

  const lastCall = () => {
    const calls = vi.mocked(useUnprocessedPayloadsQuery).mock.calls;
    return calls[calls.length - 1] as unknown as [{ source?: string | null }, string | undefined, number, boolean];
  };

  it('shows the current page and the total, with Previous disabled on the first page', () => {
    render(<UnprocessedPayloadsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('payload-on-page-one')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('45 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('goes forward and back, fetching each page with its own cursor', () => {
    render(<UnprocessedPayloadsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(lastCall()[1]).toBe('c1');
    expect(screen.getByText('payload-on-page-two')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(lastCall()[1]).toBeUndefined();
    expect(screen.getByText('payload-on-page-one')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('returns to page 1 when a filter changes (BUG-019)', () => {
    render(<UnprocessedPayloadsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('pick source'));

    const [filters, cursor] = lastCall();
    expect(filters.source).toBe('APIFY');
    expect(cursor).toBeUndefined();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('"Clear" returns to page 1 even when no filter is set', () => {
    render(<UnprocessedPayloadsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

    // No filter was set, so clearing changes no filter value and the controller's filter key stays the same:
    // without an explicit reset this left the moderator on page 3.
    fireEvent.click(screen.getByText('clear filters'));

    expect(lastCall()[1]).toBeUndefined();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('payload-on-page-one')).toBeInTheDocument();
  });

  it('does not refetch from the filter handler: the new filter changes the query key, which fetches by itself', () => {
    render(<UnprocessedPayloadsContent />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('pick source'));
    expect(lastCall()[0].source).toBe('APIFY');
    // `refetch` is bound to the query being replaced; calling it from the handler re-requested the old page.
    expect(refetchSpy).not.toHaveBeenCalled();
  });
});
