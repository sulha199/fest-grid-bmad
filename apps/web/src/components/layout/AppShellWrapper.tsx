'use client';

import * as React from 'react';
import { ReactNode } from 'react';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { AppShell, NavKey, AmbientLocationBanner, isGeolocationCaptureFailure } from '@festgrid/ui';
import { useMeQuery, useModeratorPendingItemCountQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useHasApiKey } from '@/features/onboarding/use-has-api-key';
import { useAmbientCapabilityAskSlot, AmbientCapabilityAskParticipant } from '@/lib/hooks/useAmbientCapabilityAskSlot';
import { useAmbientCapabilityAskSlotStore } from '@/lib/state/ambient-capability-ask-slot-store';
import { useViewerLocation } from '@/lib/hooks/useViewerLocation';
import { usePostHog } from '@festgrid/analytics';

// Any slug works here — the goal is only to warm the shared @modal
// layout/loading JS chunks once per session (identical for every real event
// slug); the target page's own data fetch is skipped during prefetch since
// it's inside a Suspense boundary bounded by loading.tsx.
const MODAL_PREFETCH_WARMUP_SLUG = '__prefetch-warmup__';

export function AppShellWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('Nav');
  const tUserMenu = useTranslations('UserMenu');
  const tAmbientLocationBanner = useTranslations('AmbientLocationBanner');
  const posthog = usePostHog();
  const { user, isLoading, signOut } = useAuthSession();
  const hasApiKey = useHasApiKey();

  const isAuthenticated = !!user && !isLoading;
  const avatarUrl = user?.user_metadata?.avatar_url || undefined;
  const displayName = user?.user_metadata?.full_name || user?.email || undefined;

  const { data: meData } = useMeQuery(graphqlClient, undefined, {
    enabled: isAuthenticated,
  });
  const role = meData?.me?.role || undefined;
  const isModerator = role?.toLowerCase() === 'moderator';

  // Kept reasonably current, not instantaneous (PRD Section 3.9.3) -- a 60s poll rather than a
  // push mechanism, matching this app's lack of any existing realtime/subscription plumbing.
  const { data: pendingItemData } = useModeratorPendingItemCountQuery(graphqlClient, undefined, {
    enabled: isAuthenticated && isModerator,
    refetchInterval: 60_000,
  });
  const moderatorPendingItemCount = pendingItemData?.moderatorPendingItemCount ?? 0;

  React.useEffect(() => {
    router.prefetch(`/events/${MODAL_PREFETCH_WARMUP_SLUG}`);
  }, [router]);

  // Story 0.39 — the viewer-location ambient ask participant.
  const {
    canShowAmbientAsk: canShowLocationAsk,
    captureExplicit: captureLocationExplicit,
    dismissPermanently: dismissLocationPermanently,
    remindLater: remindLocationLater,
  } = useViewerLocation();
  const [isLocationAskPending, setIsLocationAskPending] = React.useState(false);
  const markAmbientSlotDismissedThisSession = useAmbientCapabilityAskSlotStore(
    (state) => state.markDismissedThisSession
  );

  // Story 0.42 — the shared Ambient Capability Ask slot. List position IS the
  // priority order (index 0 highest) — 'location' is registered ahead of
  // where a future 'pwa-install' (Story 0.38) entry will be added, per this
  // story's own Task 5.3.
  const ambientAskParticipants: AmbientCapabilityAskParticipant[] = [
    { id: 'location', canShow: canShowLocationAsk },
  ];
  const ambientAskWinnerId = useAmbientCapabilityAskSlot(ambientAskParticipants);

  const handleEnableLocationClick = async () => {
    setIsLocationAskPending(true);
    try {
      await captureLocationExplicit();
      posthog.capture('viewer_location_ambient_consent_resolved', { outcome: 'granted' });
    } catch (error) {
      // Story 1.i1f review finding 9 — a timeout / unavailable / unknown capture
      // is a failed attempt, not a consent decision; only a real
      // 'permission-denied' is a denial. Tagging every failure as 'denied'
      // corrupted the consent funnel this event exists to measure.
      posthog.capture('viewer_location_ambient_consent_resolved', {
        outcome: isGeolocationCaptureFailure(error) ? error.code : 'unknown',
      });
    } finally {
      setIsLocationAskPending(false);
    }
  };

  const handleDismissLocationPermanent = () => {
    dismissLocationPermanently();
    markAmbientSlotDismissedThisSession();
    posthog.capture('viewer_location_ambient_dismissed_permanent');
  };

  const handleRemindLocationLater = () => {
    remindLocationLater();
    markAmbientSlotDismissedThisSession();
    posthog.capture('viewer_location_ambient_dismissed_cooldown');
  };

  const hasFiredLocationBannerShown = React.useRef(false);
  React.useEffect(() => {
    if (ambientAskWinnerId === 'location' && !hasFiredLocationBannerShown.current) {
      hasFiredLocationBannerShown.current = true;
      posthog.capture('viewer_location_ambient_banner_shown');
    }
  }, [ambientAskWinnerId, posthog]);

  const ambientBannerById: Record<string, React.ReactNode> = {
    location: (
      <AmbientLocationBanner
        labels={{
          message: tAmbientLocationBanner('message'),
          enableButtonLabel: tAmbientLocationBanner('enableButtonLabel'),
          notNowButtonLabel: tAmbientLocationBanner('notNowButtonLabel'),
          remindLaterButtonLabel: tAmbientLocationBanner('remindLaterButtonLabel'),
        }}
        onEnableClick={handleEnableLocationClick}
        onDismissPermanent={handleDismissLocationPermanent}
        onRemindLater={handleRemindLocationLater}
        isPending={isLocationAskPending}
      />
    ),
  };
  const ambientBanner: React.ReactNode =
    ambientAskWinnerId != null ? ambientBannerById[ambientAskWinnerId] : undefined;

  const labels: Record<NavKey, string> = {
    discover: t('discover'),
    feed: t('feed'),
    favorites: t('favorites'),
    calendar: t('calendar'),
    login: t('login'),
  };

  const userMenuLabels = {
    profile: tUserMenu('profile'),
    locations: tUserMenu('locations'),
    aiFilters: tUserMenu('aiFilters'),
    accountSettings: tUserMenu('accountSettings'),
    manualPostSelection: tUserMenu('manualPostSelection'),
    reports: tUserMenu('reports'),
    archive: tUserMenu('archive'),
    moderatorItems: tUserMenu('moderatorItems'),
    moderatorTools: tUserMenu('moderatorTools'),
    widgets: tUserMenu('widgets'),
    logout: tUserMenu('logout'),
    close: tUserMenu('close'),
  };

  return (
    <AppShell
      ambientBanner={ambientBanner}
      isAuthenticated={isAuthenticated}
      avatarUrl={avatarUrl}
      displayName={displayName}
      currentPath={pathname}
      renderLink={Link}
      labels={labels}
      role={role}
      moderatorPendingItemCount={moderatorPendingItemCount}
      onSignOut={signOut}
      userMenuLabels={userMenuLabels}
      resolveHref={(entry) => (entry.requiresApiKey && !hasApiKey ? `/wizard/onboarding/api-key?redirect=${encodeURIComponent(entry.href || '/')}` : entry.href || '/')}
    >
      {children}
    </AppShell>
  );
}
