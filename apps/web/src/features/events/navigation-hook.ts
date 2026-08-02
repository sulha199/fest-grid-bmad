import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useContextAwareListNavigation } from "@festgrid/ui"
import { useSearchParams } from "next/navigation"

function buildEventsQuery({ search, types, categories }: { search: string, types: string[], categories: string[] }): EventQueryConditionInput | undefined {
  const conditions: EventQueryConditionInput[] = []
  if (search.trim()) {
    conditions.push({
      operator: "or",
      conditions: [
        { field: "eventName", operator: "contains", value: search },
        { field: "performers", operator: "contains", value: search },
        { field: "location", operator: "contains", value: search },
      ]
    })
  }
  if (types.length > 0) {
    conditions.push({ field: "types", operator: "in", value: types })
  }
  if (categories.length > 0) {
    conditions.push({ field: "categories", operator: "in", value: categories })
  }
  if (conditions.length === 0) return undefined;
  return { operator: "and", conditions }
}

export function useListNavigationForEvent(currentEventId: string) {
  const searchParams = useSearchParams()
  const [q] = useQueryState('q', parseAsString.withDefault(''))
  const [types] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]))

  // Only enable if search params are present (signaling originating list context)
  const hasListContext = searchParams.size > 0;

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
        query: buildEventsQuery({ search: q, types, categories })
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.events.hasMore ? allPages.length * 10 : undefined
    },
    enabled: hasListContext,
  })

  type EventItem = GetEventsQuery['events']['items'][number];
  const items: EventItem[] = (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []

  const nav = useContextAwareListNavigation({
    items,
    currentId: currentEventId,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })

  return {
    ...nav,
    hasListContext,
  }
}
