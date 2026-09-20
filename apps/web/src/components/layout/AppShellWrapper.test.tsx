import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({ user: null, isLoading: false, signOut: vi.fn() }),
}));

vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {},
}));

vi.mock('@/generated/graphql', () => ({
  useMeQuery: () => ({ data: undefined }),
  useModeratorPendingItemCountQuery: () => ({ data: undefined }),
}));

vi.mock('@/features/onboarding/use-has-api-key', () => ({
  useHasApiKey: () => false,
}));

// Capture the props AppShell is rendered with, without needing its full nav
// chrome/UserMenu tree — this test's job (Story 0.42 Task 4.2) is proving
// AppShellWrapper's own wiring, not re-testing AppShell itself (AppShell.test.tsx).
let lastAppShellProps: any = null;
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    AppShell: (props: any) => {
      lastAppShellProps = props;
      return <div data-testid="app-shell-stub">{props.children}</div>;
    },
  };
});

import { AppShellWrapper } from './AppShellWrapper';

describe('AppShellWrapper (Story 0.42 AC14, empty-participants wiring)', () => {
  afterEach(() => {
    cleanup();
    lastAppShellProps = null;
  });

  it('renders without error and passes ambientBanner={undefined} through to AppShell', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AppShellWrapper>
          <div data-testid="page-content">content</div>
        </AppShellWrapper>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('app-shell-stub')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(lastAppShellProps.ambientBanner).toBeUndefined();
  });
});
