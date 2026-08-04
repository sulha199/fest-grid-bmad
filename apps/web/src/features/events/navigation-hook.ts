import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useContextAwareListNavigation } from "@festgrid/ui"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { buildEventsQueryCondition } from "@festgrid/domain/events"

const FAVORITES_PAGE_SIZE = 10;

export function useListNavigationForEvent(currentEventId: string, isModal: boolean) {
  const searchParams = useSearchParams()
  const [q] = useQueryState('q', parseAsString.withDefault(''))
  const [types] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]))
  const fromList = searchParams.get('fromList');
  const isFavoritesContext = fromList === 'favorites';

  const frozenFavoriteIds = useMemo(() => {
    const value = searchParams.get('favoriteIds');
    if (!value) {
      return [] as string[];
    }
    return value.split(',').map((id) => id.trim()).filter(Boolean);
  }, [searchParams]);

  // URL context explicitly requires actual filter parameters, not just any query string (like tracking params)
  const hasUrlFilters = searchParams.has('q') || searchParams.has('types') || searchParams.has('categories');
  
  // We only fetch if we are actually requesting list context on a full-page load.
  // (In the modal, the underlying list already fetches, so we don't strictly need to enable this query, 
  // but it's safe to do so. We disable it on full-page loads without filters to avoid unnecessary fetches.)
  const shouldFetchList = isModal || hasUrlFilters;
  const shouldFetchFavoritesList = isFavoritesContext && frozenFavoriteIds.length > 0;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ['events', { q, types, categories }],
    queryFn: async ({ pageParam }) => {
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number,
        query: buildEventsQueryCondition({ search: q, types, categories }) as EventQueryConditionInput | undefined
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.events.hasMore ? allPages.length * 10 : undefined
    },
    enabled: shouldFetchList && !isFavoritesContext,
  })

  const {
    data: favoritesData,
    fetchNextPage: fetchNextFavoritePage,
    hasNextPage: hasNextFavoritePage,
    isFetchingNextPage: isFetchingNextFavoritePage,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ['favorites-navigation-events', { ids: frozenFavoriteIds }],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const batchIds = frozenFavoriteIds.slice(offset, offset + FAVORITES_PAGE_SIZE);

      if (batchIds.length === 0) {
        return {
          events: {
            items: [],
            hasMore: false,
            totalCount: frozenFavoriteIds.length,
          },
        } as GetEventsQuery;
      }

      const response = await graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: batchIds.length,
        offset: 0,
        query: {
          operator: 'and',
          conditions: [{ field: 'id', operator: 'in', value: batchIds }],
        },
      });

      const indexMap = new Map(batchIds.map((id, index) => [id, index]));
      const orderedItems = [...response.events.items].sort((a, b) => {
        const aIndex = indexMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = indexMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });

      return {
        events: {
          ...response.events,
          items: orderedItems,
          hasMore: offset + FAVORITES_PAGE_SIZE < frozenFavoriteIds.length,
          totalCount: frozenFavoriteIds.length,
        },
      };
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => {
      const nextOffset = allPages.length * FAVORITES_PAGE_SIZE;
      return nextOffset < frozenFavoriteIds.length ? nextOffset : undefined;
    },
    enabled: shouldFetchFavoritesList,
  })

  type EventItem = GetEventsQuery['events']['items'][number];
  const items: EventItem[] = isFavoritesContext
    ? (favoritesData?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []
    : (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []

  const nav = useContextAwareListNavigation({
    items,
    currentId: currentEventId,
    hasNextPage: isFavoritesContext ? !!hasNextFavoritePage : !!hasNextPage,
    isFetchingNextPage: isFavoritesContext ? isFetchingNextFavoritePage : isFetchingNextPage,
    fetchNextPage: isFavoritesContext ? fetchNextFavoritePage : fetchNextPage,
  })

  // We explicitly declare list context exists ONLY if:
  // 1. We are in the modal (always has list context) OR the URL carries filter context
  // AND
  // 2. The item was actually found in the list (nav.hasContext)
  const isContextValidForRoute = isFavoritesContext ? frozenFavoriteIds.length > 0 : (isModal || hasUrlFilters);

  return {
    ...nav,
    hasListContext: isContextValidForRoute && nav.hasContext,
  }
}
