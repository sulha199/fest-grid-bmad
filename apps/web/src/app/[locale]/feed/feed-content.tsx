"use client";

import { useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery, InfiniteData, useQueryClient } from "@tanstack/react-query";
import { EventListView, useInfiniteScroll, EventDiscoveryPanel, PageContainer, AIFilterOverlay, BlockingLoader } from "@festgrid/ui";
import { EventCategory, EventType } from "@festgrid/shared-types";
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput, useToggleFavoriteMutation, useGetMySubscriptionsQuery } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";
import { usePostHog } from "@festgrid/analytics";
import { useRouter, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { buildFeedQueryCondition } from "@festgrid/domain/events";
import { FeedCalendarView } from "./FeedCalendarView";
import { SubscriptionPicker } from "@festgrid/ui";
import { useAIFilter } from "@/features/events/use-ai-filter";

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

export function FeedContent() {
  const t = useTranslations("FeedPage");
  const tCategory = useTranslations("EventCategory");
  const tType = useTranslations("EventType");
  const tFilterHub = useTranslations("FilterHub");
  const tNearby = useTranslations("NearbyFilter");
  const posthog = usePostHog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading } = useAuthSession();
  const queryClient = useQueryClient();
  const aiFilter = useAIFilter();

  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [types] = useQueryState("types", parseAsArrayOf(parseAsString).withDefault([]));
  const [categories] = useQueryState("categories", parseAsArrayOf(parseAsString).withDefault([]));
  const [view] = useQueryState("view", parseAsString.withDefault("card"));
  const [subscriptionsQuery, setSubscriptionsQuery] = useQueryState(
    "subscriptions",
    parseAsArrayOf(parseAsString, ",").withDefault([])
  );

  const { data: subData } = useGetMySubscriptionsQuery(
    graphqlClient,
    undefined,
    {
      enabled: !!session && !isLoading,
    }
  );

  const showSubscriptionPicker = (subData?.mySubscriptions?.length ?? 0) > 1;

  // AC1: Redirect to login if unauthenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login");
    }
  }, [isLoading, session, router]);

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  );
  const typeLabels = useMemo(() => buildEnumLabels(Object.values(EventType), tType), [tType]);

  const filterLabels = useMemo(
    () => ({
      typeLabel: tFilterHub("typeLabel"),
      categoryLabel: tFilterHub("categoryLabel"),
      clearLabel: tFilterHub("clearLabel"),
      aiTriggerTooltip: tFilterHub("aiTriggerTooltip"),
      aiClearLabel: tFilterHub("aiClearLabel"),
      aiExpandLabel: tFilterHub("aiExpandLabel"),
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

  const queryCondition = useMemo(() => {
    return buildFeedQueryCondition({
      search: q,
      types,
      categories,
      subscriptions: subscriptionsQuery,
      filter: aiFilter.activeFilter ?? undefined,
    });
  }, [q, types, categories, subscriptionsQuery, aiFilter.activeFilter]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: listStatus,
    error,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ["events", "feed", { q, types, categories, subscriptions: subscriptionsQuery, aiFilter: aiFilter.activeFilter }],
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
    enabled: !!session && !isLoading,
  });

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const { mutate: toggleFavorite } = useToggleFavoriteMutation(graphqlClient, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["events", "feed"] });
      const previousData = queryClient.getQueryData(["events", "feed", { q, types, categories, subscriptions: subscriptionsQuery }]);

      queryClient.setQueriesData({ queryKey: ["events", "feed"] }, (old: any) => {
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
        queryClient.setQueryData(["events", "feed", { q, types, categories, subscriptions: subscriptionsQuery }], context.previousData);
      }
    },
    onSuccess: (data, variables) => {
      posthog.capture(data.toggleFavorite.isFavorited ? "event_favorited" : "event_unfavorited", {
        eventId: variables.eventId,
      });
    },
  });

  type EventItem = GetEventsQuery["events"]["items"][number];
  const events: EventItem[] =
    (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? [];

  const handleSearchSubmit = useMemo(
    () => (searchQuery: string) => {
      setQ(searchQuery || "");
    },
    [setQ]
  );

  // Return empty list if unauthenticated or loading session
  if (isLoading || !session) {
    return null;
  }

  return (
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {showSubscriptionPicker && subData?.mySubscriptions && (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <SubscriptionPicker
            facetLabel={t("subscriptionFilterLabel")}
            subscriptions={subData.mySubscriptions as any}
            value={subscriptionsQuery}
            onChange={setSubscriptionsQuery}
            labels={{ clearLabel: tFilterHub("clearLabel") }}
          />
        </div>
      )}

      <EventDiscoveryPanel
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
        showAITrigger={aiFilter.filterHubProps.showAITrigger}
        onAITriggerClick={aiFilter.filterHubProps.onAITriggerClick}
        aiFilterSummary={aiFilter.filterHubProps.aiFilterSummary}
        aiCaveatsText={aiFilter.filterHubProps.aiCaveatsText}
        onAIClear={aiFilter.filterHubProps.onAIClear}
        onAIExpand={aiFilter.filterHubProps.onAIExpand}
        views={[
          {
            id: "card",
            label: "Card View",
            content: (
              <div className="flex flex-col gap-4">
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
                    {!(q.trim() || types.length > 0 || categories.length > 0) && (
                      <Link
                        href="/settings/account"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                      >
                        {t("emptyStateCta")}
                      </Link>
                    )}
                  </div>
                }
                cardLabels={{
                  favoriteToggle: t("favoriteButtonLabel") || "Toggle Favorite",
                  priceFrom: t("priceFrom") || "From",
                  categoryLabels,
                  typeLabels,
                }}
                getCardProps={(event) => ({
                  isFavorited: event.isFavorited,
                  favoriteCount: event.favoriteCount,
                  onFavoriteToggle: () => toggleFavorite({ eventId: event.id }),
                  onClick: () => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("fromList", "feed");
                    router.push(`/events/${event.slug}?${params.toString()}`);
                  },
                })}
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                loadingMoreLabel={t("loadingMore")}
              />
              </div>
            ),
          },
          {
            id: "calendar",
            label: "Calendar View",
            content: (
              <FeedCalendarView q={q} types={types} categories={categories} subscriptions={subscriptionsQuery} />
            ),
          },
        ]}
      />

      <AIFilterOverlay {...aiFilter.overlayProps} />
      <BlockingLoader active={aiFilter.isLoading} />

    </PageContainer>
  );
}
