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
    // Story 9.5 Task 10: an internally-consistent AND-of-leaves mirroring resolvedFilter exactly
    // -- the row now reads `.expression` (Task 9), so a drifted fixture here would silently lose
    // assertions once the renderer switches off `.resolvedFilter`.
    expression: {
      op: 'AND',
      children: [
        { field: 'keyword', value: 'rock' },
        { field: 'category', value: ['MUSIC'] },
        { field: 'isFree', value: true },
      ],
    },
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
  {
    id: 'filter-2',
    prompt: 'events in sleman or bantul',
    resolvedFilter: {},
    // Genuinely non-flat expression -- the concrete, user-visible proof that a saved grouped
    // filter's row summary is no longer silently flattened to "All events" (Story 9.4a's gap).
    expression: {
      op: 'OR',
      children: [
        { field: 'locationAdminArea', value: 'Sleman' },
        { field: 'locationAdminArea', value: 'Bantul' },
      ],
    },
    createdAt: '2026-08-02',
    updatedAt: '2026-08-02',
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

    // Verify it renders the summary via the shared renderer (e.g., contains 'rock' and 'free')
    expect(screen.getByText(/about 'rock'/i)).toBeInTheDocument();
    expect(screen.getByText(/free events only/i)).toBeInTheDocument();
  });

  // Story 9.5 Task 9/10: a non-flat saved filter's row summary renders its real grouped logic
  // instead of silently collapsing to "All events" (the bug this story and 9.4a together close).
  it('renders a non-flat saved filter row with the locale "or" word and both location names', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<AiFiltersContent />);

    await waitFor(() => {
      expect(screen.getByText(/events in sleman or bantul/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/in Sleman or in Bantul/i)).toBeInTheDocument();
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
    const expectedExpressionParam = encodeURIComponent(JSON.stringify(mockFilters[0].expression));
    expect(mockRouterPush).toHaveBeenCalledWith(`/?ai_filter=${expectedParam}&ai_expression=${expectedExpressionParam}`);
  });

  it('triggers soft delete immediately and RESTORE on Undo', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<AiFiltersContent />);

    await waitFor(() => {
      expect(screen.getByText(/free rock concerts/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByLabelText('Delete')[0];
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
