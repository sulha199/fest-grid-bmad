"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useInfiniteQuery, InfiniteData, useQueryClient } from "@tanstack/react-query";
import { EventListView, useInfiniteScroll, EventDiscoveryPanel, PageContainer, AccountAvatar, formatLocalizedNearbyBadgeDistance } from "@festgrid/ui";
import { EventCategory, EventType } from "@festgrid/shared-types";
import { GetEventsDocument, GetEventsQuery, useToggleFavoriteMutation } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";
import { usePostHog } from "@festgrid/analytics";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { useTemporalFilter } from "@/features/events/use-temporal-filter";
import { buildAccountEventsQueryCondition } from "@festgrid/domain/events";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoginContent } from "../../login/login-content";
import AccountCalendarView from "./AccountCalendarView";
import { mapDaysOfWeekToDomain } from "@/lib/day-of-week-mapping";
import { DayOfWeek as DomainDayOfWeek } from "@festgrid/domain/events";

interface AccountContentProps {
  platformSlug: string;
  accountId: string;
  profile: {
    id: string;
    accountId: string;
    platform: string;
    displayName: string;
    username: string | null | undefined;
    profileImageUrl: string | null | undefined;
    description: string | null | undefined;
  };
}

function buildEnumLabels(values: string[], translate: (key: string) => string) {
  return Object.fromEntries(
    values.map((value) => {
      try {
        return [value, translate(value)];
      } catch {
        return [value, value];
      }
    })
  );
}

export default function AccountContent({ platformSlug, accountId, profile }: AccountContentProps) {
  const t = useTranslations("AccountPage");
  const tCategory = useTranslations("EventCategory");
  const tType = useTranslations("EventType");
  const tDayOfWeek = useTranslations("DayOfWeek");
  const tFilterHub = useTranslations("FilterHub");
  const tNearby = useTranslations("NearbyFilter");
  const tEventCard = useTranslations("EventCard");
  const locale = useLocale();
  const posthog = usePostHog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [types] = useQueryState("types", parseAsArrayOf(parseAsString).withDefault([]));
  const [categories] = useQueryState("categories", parseAsArrayOf(parseAsString).withDefault([]));
  const [view] = useQueryState("view", parseAsString.withDefault("card"));
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (view) {
      posthog.capture("view_switched", { view });
    }
  }, [view, posthog]);

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  );
  const typeLabels = useMemo(() => buildEnumLabels(Object.values(EventType), tType), [tType]);
  // Story 1.3k Task 8 (AC9) — DayOfWeek i18n namespace, passed through to EventListView/EventCard
  // as `dayOfWeekLabels`.
  const dayOfWeekLabels = useMemo(
    () => buildEnumLabels(Object.values(DomainDayOfWeek), tDayOfWeek),
    [tDayOfWeek]
  );

  const filterLabels = useMemo(
    () => ({
      typeLabel: tFilterHub("typeLabel"),
      categoryLabel: tFilterHub("categoryLabel"),
      clearLabel: tFilterHub("clearLabel"),
      locationFilterLabels: {
        filterLabel: tNearby("filterLabel"),
        offOptionLabel: tNearby("offOptionLabel"),
        currentLocationOptionLabel: tNearby("currentLocationOptionLabel"),
        radiusLabel: tNearby("radiusLabel"),
        radiusUnit: (count: number) => tNearby("radiusUnit", { count }),
        detectingLocationLabel: tNearby("detectingLocationLabel"),
        permissionDeniedLabel: tNearby("permissionDeniedLabel"),
        unavailableLabel: tNearby("unavailableLabel"),
        locationsErrorLabel: tNearby("locationsErrorLabel"),
        noSavedLocationsHint: tNearby("noSavedLocationsHint"),
      },
    }),
    [tFilterHub, tNearby]
  );

  const typesOptions = useMemo(
    () =>
      Object.values(EventType).map((value) => ({
        value,
        label: typeLabels[value] || value,
      })),
    [typeLabels]
  );

  const categoriesOptions = useMemo(
    () =>
      Object.values(EventCategory).map((value) => ({
        value,
        label: categoryLabels[value] || value,
      })),
    [categoryLabels]
  );

  const { temporalFilter, panelProps: temporalFilterPanelProps } = useTemporalFilter();

  const queryCondition = useMemo(() => {
    return buildAccountEventsQueryCondition({
      search: q,
      types,
      categories,
      profileId: profile.id,
      temporalFilter,
    });
  }, [q, types, categories, profile.id, temporalFilter]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: listStatus,
    error,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ["events", "account", { q, types, categories, profileId: profile.id, temporalFilter }],
    queryFn: async ({ pageParam }) => {
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number,
        query: queryCondition,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.events.hasMore ? allPages.length * 10 : undefined;
    },
    enabled: true,
  });

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const { mutate: toggleFavorite } = useToggleFavoriteMutation(graphqlClient, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["events", "account"] });
      const previousData = queryClient.getQueryData([
        "events",
        "account",
        { q, types, categories, profileId: profile.id },
      ]);

      queryClient.setQueriesData({ queryKey: ["events", "account"] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            events: {
              ...page.events,
              items: page.events.items.map((item: any) =>
                item.id === variables.eventId
                  ? {
                      ...item,
                      isFavorited: !item.isFavorited,
                      favoriteCount: Math.max(0, (item.favoriteCount ?? 0) + (item.isFavorited ? -1 : 1)),
                    }
                  : item
              ),
            },
          })),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["events", "account", { q, types, categories, profileId: profile.id }],
          context.previousData
        );
      }
    },
    onSuccess: (data, variables) => {
      posthog.capture(data.toggleFavorite.isFavorited ? "event_favorited" : "event_unfavorited", {
        eventId: variables.eventId,
      });
    },
  });

  type EventItem = GetEventsQuery["events"]["items"][number];
  // Story 1.3k Task 9 — map each schedule's GraphQL-typed `applicableDaysOfWeek` to the domain
  // enum (AD-19 Rule 2/3), consumed by `EventListView`'s repeat badge.
  const events = ((data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []).map(
    (event: EventItem) => ({
      ...event,
      schedules: (event.schedules ?? []).map((schedule) => ({
        ...schedule,
        applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule.applicableDaysOfWeek),
      })),
    })
  );

  const handleSearchSubmit = useMemo(
    () => (searchQuery: string) => {
      setQ(searchQuery || "");
    },
    [setQ]
  );

  return (
    <PageContainer>
      {/* Account Profile Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <AccountAvatar
          profileImageUrl={profile.profileImageUrl}
          displayName={profile.displayName}
          username={profile.username}
          size="lg"
        />
        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.displayName}</h1>
          {profile.description && (
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">{profile.description}</p>
          )}
        </div>
      </div>

      <EventDiscoveryPanel
        {...temporalFilterPanelProps}
        query={q}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t("searchPlaceholder")}
        searchClearLabel={t("searchClearLabel")}
        showFiltersLabel={t("showFiltersLabel")}
        filterLabels={filterLabels}
        types={typesOptions}
        categories={categoriesOptions}
        isAuthenticated={false}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={10}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={() => {}}
        onRadiusChange={() => {}}
        views={[
          {
            id: "card",
            label: "Card View",
            content: (
              <EventListView
                status={listStatus === "pending" ? "loading" : listStatus}
                events={events}
                errorMessage={t("errorState")}
                errorDetail={error?.message || "Unknown error"}
                emptyState={
                  <div className="text-center py-10 space-y-4">
                    <p className="text-muted-foreground">
                      {q.trim() || types.length > 0 || categories.length > 0
                        ? t("searchEmptyState")
                        : t("emptyState")}
                    </p>
                  </div>
                }
                cardLabels={{
                  favoriteToggle: tEventCard("favoriteToggle"),
                  priceFrom: t("priceFrom") || "From",
                  categoryLabels,
                  typeLabels,
                  dayOfWeekLabels,
                  tillLabel: tEventCard("tillLabel"),
                  statusEnded: tEventCard("statusEnded"),
                  statusHappeningNow: tEventCard("statusHappeningNow"),
                  statusEndsToday: tEventCard("statusEndsToday"),
                  statusEndsAt: tEventCard.raw("statusEndsAt"),
                  statusInHours: tEventCard.raw("statusInHours"),
                  statusInDays: tEventCard.raw("statusInDays"),
                  statusUpcoming: tEventCard("statusUpcoming"),
                  tomorrow: tEventCard("tomorrow"),
                  nearbyBadge: (distanceKm: number) => formatLocalizedNearbyBadgeDistance(locale, distanceKm),
                }}
                getCardProps={(event) => ({
                  isFavorited: event.isFavorited,
                  favoriteCount: event.favoriteCount,
                  onFavoriteToggle: () => {
                    if (!session) {
                      setIsLoginModalOpen(true);
                    } else {
                      toggleFavorite({ eventId: event.id });
                    }
                  },
                  onClick: () => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("fromList", "account");
                    router.push(`/events/${event.slug}?${params.toString()}`);
                  },
                })}
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                loadingMoreLabel={t("loadingMore")}
              />
            ),
          },
          {
            id: "calendar",
            label: "Calendar View",
            content: (
              <AccountCalendarView
                q={q}
                types={types}
                categories={categories}
                profile={profile}
                onFavoriteToggle={(eventId) => {
                  if (!session) {
                    setIsLoginModalOpen(true);
                  } else {
                    toggleFavorite({ eventId });
                  }
                }}
              />
            ),
          },
        ]}
      />

      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <LoginContent />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
