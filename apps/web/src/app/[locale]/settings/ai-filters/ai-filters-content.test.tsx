import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { AiFiltersContent } from './ai-filters-content';
import { Toaster } from 'sonner';

const mockRouterPush = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

let mockSession: any = { user: { id: 'user-1', email: 'user@test.dev' } };
let mockAuthLoading = false;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

const mockFilters = [
  {
    id: 'filter-1',
    prompt: 'free rock concerts',
    resolvedFilter: {
      keyword: 'rock',
      categories: ['MUSIC'],
      isFree: true,
    },
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
];

let deleteCalls: { id: string; action: string }[] = [];

const server = setupServer(
  graphql.query('getMyAIEventFilters', () => {
    return HttpResponse.json({
      data: {
        myAIEventFilters: mockFilters,
      },
    });
  }),
  graphql.mutation('deleteAIEventFilter', ({ variables }) => {
    deleteCalls.push({ id: variables.id, action: variables.action });
    return HttpResponse.json({
      data: {
        deleteAIEventFilter: { id: variables.id },
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  deleteCalls = [];
});
afterAll(() => server.close());

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Toaster />
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('AiFiltersContent', () => {
  it('redirects unauthenticated users to /login', async () => {
    mockSession = null;
    renderWithProviders(<AiFiltersContent />);
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders loading states and then displays saved filters', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<AiFiltersContent />);

    await waitFor(() => {
      expect(screen.getByText(/free rock concerts/i)).toBeInTheDocument();
    });

    // Verify it renders the summary using renderAIFilterSummary (e.g., contains 'rock' and 'free')
    expect(screen.getByText(/about 'rock'/i)).toBeInTheDocument();
    expect(screen.getByText(/free events only/i)).toBeInTheDocument();
  });

  it('navigates to Discovery with filter params when row is clicked', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<AiFiltersContent />);

    await waitFor(() => {
      expect(screen.getByText(/free rock concerts/i)).toBeInTheDocument();
    });

    const row = screen.getByText(/free rock concerts/i).closest('.cursor-pointer');
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);

    const expectedParam = encodeURIComponent(JSON.stringify(mockFilters[0].resolvedFilter));
    expect(mockRouterPush).toHaveBeenCalledWith(`/?ai_filter=${expectedParam}`);
  });

  it('triggers soft delete immediately and RESTORE on Undo', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<AiFiltersContent />);

    await waitFor(() => {
      expect(screen.getByText(/free rock concerts/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByLabelText('Delete');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteCalls).toContainEqual({ id: 'filter-1', action: 'DELETE' });
    });

    const undoButton = await screen.findByText('Undo');
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(deleteCalls).toContainEqual({ id: 'filter-1', action: 'RESTORE' });
    });
  });
});
