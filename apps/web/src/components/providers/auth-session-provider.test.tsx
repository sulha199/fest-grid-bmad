import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthSessionProvider } from './auth-session-provider';
import { Session } from '@supabase/supabase-js';

const { mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

let updateUserTimezoneVariables: any = null;
let updateUserTimezoneCallCount = 0;

const server = setupServer(
  graphql.mutation('updateUserTimezone', ({ variables }) => {
    updateUserTimezoneCallCount++;
    updateUserTimezoneVariables = variables;
    return HttpResponse.json({
      data: {
        updateUserTimezone: true,
      },
    });
  }),
  graphql.query('me', () => {
    return HttpResponse.json({
      data: {
        me: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'user',
        },
      },
    });
  })
);

beforeAll(() => server.listen());

afterEach(() => {
  server.resetHandlers();
  updateUserTimezoneVariables = null;
  updateUserTimezoneCallCount = 0;
  vi.clearAllMocks();
});

describe('AuthSessionProvider timezone capture', () => {
  let authStateChangeCallback: any;

  beforeEach(() => {
    const mockSession: Session = {
      access_token: 'test-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'Bearer',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_anonymous: false,
      },
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    mockOnAuthStateChange.mockImplementation((callback: any) => {
      authStateChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });
  });

  it('should capture timezone on initial session establishment', async () => {
    renderWithProviders(
      <AuthSessionProvider>
        <div>Test</div>
      </AuthSessionProvider>
    );

    await waitFor(() => {
      expect(updateUserTimezoneCallCount).toBeGreaterThan(0);
    });

    expect(updateUserTimezoneVariables).toBeDefined();
    expect(updateUserTimezoneVariables.timezone).toBeDefined();
  });

  it('should capture timezone on subsequent auth state changes with a session', async () => {
    const mockSession2: Session = {
      access_token: 'test-token-2',
      refresh_token: 'refresh-token-2',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'Bearer',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_anonymous: false,
      },
    };

    renderWithProviders(
      <AuthSessionProvider>
        <div>Test</div>
      </AuthSessionProvider>
    );

    const initialCallCount = updateUserTimezoneCallCount;

    // Simulate auth state change with a session
    if (authStateChangeCallback) {
      authStateChangeCallback('USER_UPDATED', mockSession2);
    }

    await waitFor(() => {
      expect(updateUserTimezoneCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  it('should fail silently if mutation error occurs', async () => {
    server.use(
      graphql.mutation('updateUserTimezone', () => {
        return HttpResponse.json(
          {
            errors: [{ message: 'Network error' }],
          },
          { status: 500 }
        );
      })
    );

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderWithProviders(
      <AuthSessionProvider>
        <div>Test</div>
      </AuthSessionProvider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timezone capture failed'),
        expect.anything()
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('should not call mutation excessively on re-renders (AC4: useCallback memoization)', async () => {
    const mockSession: Session = {
      access_token: 'test-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'Bearer',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_anonymous: false,
      },
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <div>Test</div>
        </AuthSessionProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(updateUserTimezoneCallCount).toBeGreaterThan(0);
    });

    const callCountAfterInitial = updateUserTimezoneCallCount;

    // Force re-render by rendering the same component again
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <div>Test</div>
        </AuthSessionProvider>
      </QueryClientProvider>
    );

    // Wait a moment to allow any spurious effect runs to occur
    await waitFor(() => {
      expect(updateUserTimezoneCallCount).toBeLessThanOrEqual(callCountAfterInitial + 1);
    }, { timeout: 1000 });

    // Verify mutation was not called excessively during re-render
    expect(updateUserTimezoneCallCount).toBe(callCountAfterInitial);
  });
});
