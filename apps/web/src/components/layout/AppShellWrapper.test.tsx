import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
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

const mockPosthogCapture = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({ capture: mockPosthogCapture }),
}));

// Story 0.39 — control the location participant's eligibility per test rather
// than driving it through real navigator.permissions/localStorage timing.
const mockCaptureExplicit = vi.fn();
const mockDismissPermanently = vi.fn();
const mockRemindLater = vi.fn();
let mockCanShowAmbientAsk = false;
vi.mock('@/lib/hooks/useViewerLocation', () => ({
  useViewerLocation: () => ({
    canShowAmbientAsk: mockCanShowAmbientAsk,
    captureExplicit: mockCaptureExplicit,
    dismissPermanently: mockDismissPermanently,
    remindLater: mockRemindLater,
  }),
}));

// Capture the props AppShell is rendered with, without needing its full nav
// chrome/UserMenu tree — this test's job is proving AppShellWrapper's own
// wiring, not re-testing AppShell (AppShell.test.tsx) or AmbientLocationBanner
// (AmbientLocationBanner.test.tsx) themselves.
let lastAppShellProps: any = null;
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    AppShell: (props: any) => {
      lastAppShellProps = props;
      return (
        <div data-testid="app-shell-stub">
          {props.ambientBanner}
          {props.children}
        </div>
      );
    },
  };
});

import { AppShellWrapper } from './AppShellWrapper';
import { useAmbientCapabilityAskSlotStore } from '@/lib/state/ambient-capability-ask-slot-store';
import { GeolocationCaptureFailure } from '@festgrid/ui';

function renderWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShellWrapper>
        <div data-testid="page-content">content</div>
      </AppShellWrapper>
    </QueryClientProvider>
  );
}

describe('AppShellWrapper (Story 0.42 AC14 + Story 0.39 Task 5.3 location participant)', () => {
  beforeEach(() => {
    mockCanShowAmbientAsk = false;
    useAmbientCapabilityAskSlotStore.setState({ dismissedThisSession: false });
  });

  afterEach(() => {
    cleanup();
    lastAppShellProps = null;
    vi.clearAllMocks();
  });

  it('passes ambientBanner={undefined} through to AppShell when no participant is eligible', () => {
    renderWrapper();

    expect(screen.getByTestId('app-shell-stub')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(lastAppShellProps.ambientBanner).toBeUndefined();
  });

  it('renders the AmbientLocationBanner when the location participant is eligible', () => {
    mockCanShowAmbientAsk = true;
    renderWrapper();

    expect(screen.getByRole('button', { name: 'AmbientLocationBanner.enableButtonLabel' })).toBeInTheDocument();
    expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_banner_shown');
  });

  it('clicking the primary action calls captureExplicit and fires the resolved-granted event', async () => {
    mockCanShowAmbientAsk = true;
    mockCaptureExplicit.mockResolvedValue({ latitude: 1, longitude: 2 });
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.enableButtonLabel' }));

    expect(mockCaptureExplicit).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_consent_resolved', {
        outcome: 'granted',
      });
    });
  });

  it('tags a genuine permission denial as permission-denied rather than a generic denied (finding 9)', async () => {
    mockCanShowAmbientAsk = true;
    mockCaptureExplicit.mockRejectedValue(new GeolocationCaptureFailure('permission-denied'));
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.enableButtonLabel' }));

    await vi.waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_consent_resolved', {
        outcome: 'permission-denied',
      });
    });
    expect(mockPosthogCapture).not.toHaveBeenCalledWith('viewer_location_ambient_consent_resolved', {
      outcome: 'denied',
    });
  });

  it('tags a timed-out capture with its own outcome, not a consent denial (finding 9)', async () => {
    mockCanShowAmbientAsk = true;
    mockCaptureExplicit.mockRejectedValue(new GeolocationCaptureFailure('timeout'));
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.enableButtonLabel' }));

    await vi.waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_consent_resolved', {
        outcome: 'timeout',
      });
    });
  });

  it('falls back to unknown when the rejection is not a typed capture failure (finding 9)', async () => {
    mockCanShowAmbientAsk = true;
    mockCaptureExplicit.mockRejectedValue(new Error('boom'));
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.enableButtonLabel' }));

    await vi.waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_consent_resolved', {
        outcome: 'unknown',
      });
    });
  });

  it('clicking "Not now" calls both the persisted dismissal and the shared slot session-dismiss, and fires its event', () => {
    mockCanShowAmbientAsk = true;
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.notNowButtonLabel' }));

    expect(mockDismissPermanently).toHaveBeenCalledTimes(1);
    expect(useAmbientCapabilityAskSlotStore.getState().dismissedThisSession).toBe(true);
    expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_dismissed_permanent');
  });

  it('clicking "Remind me in 2 weeks" calls both the persisted cooldown and the shared slot session-dismiss, and fires its event', () => {
    mockCanShowAmbientAsk = true;
    renderWrapper();

    fireEvent.click(screen.getByRole('button', { name: 'AmbientLocationBanner.remindLaterButtonLabel' }));

    expect(mockRemindLater).toHaveBeenCalledTimes(1);
    expect(useAmbientCapabilityAskSlotStore.getState().dismissedThisSession).toBe(true);
    expect(mockPosthogCapture).toHaveBeenCalledWith('viewer_location_ambient_dismissed_cooldown');
  });
});
