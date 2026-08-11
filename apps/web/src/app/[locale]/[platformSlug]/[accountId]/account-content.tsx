"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery, InfiniteData, useQueryClient } from "@tanstack/react-query";
import { EventListView, useInfiniteScroll, EventDiscoveryPanel } from "@festgrid/ui";
import { EventCategory, EventType } from "@festgrid/shared-types";
import { GetEventsDocument, GetEventsQuery, useToggleFavoriteMutation } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";
import { usePostHog } from "@festgrid/analytics";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { buildAccountEventsQueryCondition } from "@festgrid/domain/events";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoginContent } from "../../login/login-content";
import AccountCalendarView from "./AccountCalendarView";

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
  const tFilterHub = useTranslations("FilterHub");
  const tNearby = useTranslations("NearbyFilter");
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

  const queryCondition = useMemo(() => {
    return buildAccountEventsQueryCondition({
      search: q,
      types,
      categories,
      profileId: profile.id,
    });
  }, [q, types, categories, profile.id]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: listStatus,
    error,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ["events", "account", { q, types, categories, profileId: profile.id }],
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
                  ? { ...item, isFavorited: !item.isFavorited }
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
  const events: EventItem[] =
    (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? [];

  const handleSearchSubmit = useMemo(
    () => (searchQuery: string) => {
      setQ(searchQuery || "");
    },
    [setQ]
  );

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Account Profile Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        {profile.profileImageUrl && (
          <img
            src={profile.profileImageUrl}
            alt={profile.displayName}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
          />
        )}
        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.displayName}</h1>
          {profile.description && (
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">{profile.description}</p>
          )}
        </div>
      </div>

      <EventDiscoveryPanel
        query={q}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t("searchPlaceholder")}
        searchClearLabel={t("searchClearLabel")}
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
                  favoriteToggle: t("favoriteButtonLabel") || "Toggle Favorite",
                  priceFrom: t("priceFrom") || "From",
                  categoryLabels,
                  typeLabels,
                }}
                getCardProps={(event) => ({
                  isFavorited: event.isFavorited,
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
    </div>
  );
}
