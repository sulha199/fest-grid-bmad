import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { ActorRunsContent } from './actor-runs-content';
import { useQueryActorRuns, useReplayActorRunMutation } from './hooks';
import { useRequireModerator } from '@/features/auth/use-require-moderator';

vi.mock('./hooks');
vi.mock('@/features/auth/use-require-moderator');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};

describe('ActorRunsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when data is loading', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() }, { wrapper: createWrapper() });
    expect(screen.queryByText('Scraper Actor Runs')).not.toBeInTheDocument();
  });

  it('shows authorization guard when not authorized', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'unauthorized' });

    render(<ActorRunsContent />, { wrapper: createWrapper() }, { wrapper: createWrapper() });
    // RouteLoader is shown (not the heading)
    expect(screen.queryByText('Scraper Actor Runs')).not.toBeInTheDocument();
  });

  it('renders empty state when no runs found', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 0,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() }, { wrapper: createWrapper() });
    expect(screen.getByText('No actor runs found')).toBeInTheDocument();
  });

  it('renders actor runs in list', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [
            {
              node: {
                id: '1',
                vendor: 'APIFY',
                triggerMode: 'SYNC',
                status: 'SUCCEEDED',
                runId: 'run-123',
                itemCount: 5,
                rawInput: { test: 'input' },
                rawOutput: { test: 'output' },
                errorMessage: null,
                startedAt: new Date().toISOString(),
              },
              cursor: 'cursor-1',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 1,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() }, { wrapper: createWrapper() });
    expect(screen.getByText('run-123')).toBeInTheDocument();
  });

  it('expands and collapses run details', async () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [
            {
              node: {
                id: '1',
                vendor: 'APIFY',
                triggerMode: 'SYNC',
                status: 'SUCCEEDED',
                runId: 'run-123',
                itemCount: 5,
                rawInput: { test: 'input' },
                rawOutput: { test: 'output' },
                errorMessage: null,
                startedAt: new Date().toISOString(),
              },
              cursor: 'cursor-1',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 1,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<ActorRunsContent />);

    // Initially details should not be visible
    expect(screen.queryByText('Raw Input')).not.toBeInTheDocument();

    // Click expand button
    const expandButton = container.querySelector('button[aria-label*="View details"]');
    fireEvent.click(expandButton!);

    // Details should now be visible
    await waitFor(() => {
      expect(screen.getByText('Raw Input')).toBeInTheDocument();
    });
  });

  it('filters by vendor', async () => {
    const refetchMock = vi.fn();
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 0,
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() });

    const vendorSelect = screen.getByDisplayValue('All Vendors') as HTMLSelectElement;
    fireEvent.change(vendorSelect, { target: { value: 'APIFY' } });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });

  it('handles replay action', async () => {
    const refetchMock = vi.fn();
    const replayMock = vi.fn().mockResolvedValue({
      success: true,
      postsPersisted: 3,
      message: 'Replay successful',
    });

    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [
            {
              node: {
                id: '1',
                vendor: 'APIFY',
                triggerMode: 'SYNC',
                status: 'SUCCEEDED',
                runId: 'run-123',
                itemCount: 5,
                rawInput: { test: 'input' },
                rawOutput: { test: 'output' },
                errorMessage: null,
                startedAt: new Date().toISOString(),
              },
              cursor: 'cursor-1',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 1,
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    (useReplayActorRunMutation as any).mockReturnValue({
      mutateAsync: replayMock,
      isPending: false,
    });

    const { container } = render(<ActorRunsContent />);

    // Expand run details
    const expandButton = container.querySelector('button[aria-label*="View details"]');
    fireEvent.click(expandButton!);

    // Click replay button
    await waitFor(() => {
      const replayButton = screen.getByText('Replay');
      fireEvent.click(replayButton);
    });

    await waitFor(() => {
      expect(replayMock).toHaveBeenCalledWith({ actorRunId: '1' });
    });
  });

  it('shows error state on query error', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    const refetchMock = vi.fn();
    (useQueryActorRuns as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: refetchMock,
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() });
    expect(screen.getByText("Couldn't load runs")).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('pagination works with load more button', async () => {
    const refetchMock = vi.fn();
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryActorRuns as any).mockReturnValue({
      data: {
        queryActorRuns: {
          edges: [
            {
              node: {
                id: '1',
                vendor: 'APIFY',
                triggerMode: 'SYNC',
                status: 'SUCCEEDED',
                runId: 'run-1',
                itemCount: 1,
                rawInput: {},
                rawOutput: {},
                errorMessage: null,
                startedAt: new Date().toISOString(),
              },
              cursor: 'cursor-1',
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
          totalCount: 50,
        },
      },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });

    render(<ActorRunsContent />, { wrapper: createWrapper() });
    const loadMoreButton = screen.getByText('Load more');

    fireEvent.click(loadMoreButton);
    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });
});
