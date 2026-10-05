import React from "react"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest"
import { EventDetailWrapper } from "./EventDetailWrapper"

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Story 3.6u (Task 6) -- `intersectionObserverInstances` lets tests manually fire the
// `useVisibleOnce` sentinel's intersection callback (the real hook, from `@festgrid/ui`, is left
// unmocked -- only `EventDetailView` itself is wrapped below). `observe`/`unobserve`/`disconnect`
// stay no-ops, matching every other pre-existing test in this file that never cares about
// visibility.
const intersectionObserverInstances: MockIntersectionObserver[] = []
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    intersectionObserverInstances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}
global.IntersectionObserver = MockIntersectionObserver as any;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { toast } from "sonner"
import { graphql, HttpResponse, delay } from "msw"
import { setupServer } from "msw/node"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"

// Mock router and auth session
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterPrefetch = vi.fn()
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    prefetch: mockRouterPrefetch,
  }),
}))

let mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

const mockPosthogCapture = vi.fn()
vi.mock("@festgrid/analytics", () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}))

let mockSession: any = null
vi.mock("@/components/providers/auth-session-provider", () => ({
  useAuthSession: () => ({
    session: mockSession,
  }),
}))

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => "en",
}))

// Story 1.6f Task 7: Task 6 removed the standalone top-level Add-to-Calendar
// button that the calendar tests below used to click through to drive the
// bulk AddToCalendarDialog. `handleAddToCalendar` itself is unchanged, so this
// partially mocks `@festgrid/ui` to capture EventDetailView's props (while
// still rendering the real component, so every other pre-existing test in
// this file keeps working against real DOM) and the calendar tests now
// invoke the captured `onAddToCalendar` prop directly instead of driving the
// removed button/dialog UI.
let capturedEventDetailViewProps: any = null
vi.mock("@festgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@festgrid/ui")>()
  return {
    ...actual,
    EventDetailView: (props: any) => {
      capturedEventDetailViewProps = props
      return React.createElement(actual.EventDetailView, props)
    },
  }
})

let currentMockEvent = {
  id: "evt_1",
  eventName: "Test Event",
  slug: "test-event",
  description: "Description",
  location: "Test Location",
  types: [],
  categories: [],
  imageUrl: null as string | null,
  durableImageUrl: null as string | null,
  videoUrl: null as string | null,
  sourcePostUrl: null,
  originalPostUrl: null,
  isFavorited: false,
  favoriteCount: 3,
  isHiddenForCurrentUser: false,
  sourceSocialMediaAccountProfile: null as { accountId: string; platform: string; username: string; displayName: string; profileImageUrl: string | null } | null,
  coauthors: [] as { accountId: string; platform: string; username: string; displayName: string; profileImageUrl: string | null }[],
  sourcePosts: [] as any[],
  schedules: [],
}

let currentMockMeRole: "user" | "moderator" = "user"
let currentMockSubscriptions: { id: string; account: { accountId: string } }[] = []

// Story 3.6u (Task 6, AC6) -- `Query.relatedEventIds` mock result, configurable per test.
let currentMockRelatedEventGroups: { postId: string; eventIds: string[] }[] = []
let currentMockRelatedEventIdsDelayMs = 0
const mockGetRelatedEventIdsHandler = vi.fn()

// Deliberately not "old ± 1" -- proves the UI reads this server-supplied value
// directly (AC3/BUG-008) rather than computing a local delta.
let mockToggleFavoriteCount = 42

// Story 3.7i -- the event-detail oEmbed result now arrives via two/three independent
// GraphQL query documents instead of an embedded field on getEventBySlug. Defaults below
// are the safe "pending/not resolvable" state so tests that don't care about the embed
// path keep passing unmodified.
let currentMockEmbedBySlugResult: { status: string; html: string | null; durableImageUrl: string | null } = {
  status: "NOT_RESOLVABLE_FROM_SLUG",
  html: null,
  durableImageUrl: null,
}
let currentMockEmbedForEventResult: { status: string; html: string | null; durableImageUrl: string | null } | null = null
let currentMockEmbedForEventDelayMs = 0
const mockGetInstagramEmbedForEventHandler = vi.fn()

const api = graphql.link("*/api/graphql")

const handlers = [
  api.query("getEventBySlug", ({ query, variables }) => {
    return HttpResponse.json({
      data: {
        eventBySlug: { ...currentMockEvent },
      },
    })
  }),
  api.query("getInstagramEmbedBySlug", () => {
    return HttpResponse.json({
      data: { instagramEmbedBySlug: { ...currentMockEmbedBySlugResult } },
    })
  }),
  api.query("getInstagramEmbedForEvent", async () => {
    mockGetInstagramEmbedForEventHandler()
    if (currentMockEmbedForEventDelayMs > 0) {
      await delay(currentMockEmbedForEventDelayMs)
    }
    return HttpResponse.json({
      data: { event: { instagramEmbed: currentMockEmbedForEventResult } },
    })
  }),
  api.query("getEvents", ({ variables }) => {
    const idCondition = (variables as any)?.query?.conditions?.find((c: any) => c?.field === "id")
    const ids = (idCondition?.value ?? []) as string[]

    const eventNames: Record<string, string> = { evt_1: "Test Event", evt_2: "Second Event", evt_3: "Third Event" }
    const slugs: Record<string, string> = { evt_1: "test-event", evt_2: "second-event", evt_3: "third-event" }
    const imageUrls: Record<string, string | null> = { evt_1: null, evt_2: "https://example.com/evt2.jpg", evt_3: "https://example.com/evt3.jpg" }

    const rows = ids.map((id) => ({
      id,
      eventName: eventNames[id] ?? "Test Event",
      slug: slugs[id] ?? "test-event",
      isFavorited: true,
      imageUrl: imageUrls[id] ?? null,
      location: "Test Location",
      types: [],
      categories: [],
      schedules: [
        {
          id: `${id}-schedule`,
          isMainSchedule: true,
          eventStartDate: new Date().toISOString(),
          ticketPrice: null,
        },
      ],
    }))

    return HttpResponse.json({
      data: {
        events: {
          items: rows,
          hasMore: false,
          totalCount: rows.length,
        },
      },
    })
  }),
  api.query("getRelatedEventIds", async () => {
    mockGetRelatedEventIdsHandler()
    if (currentMockRelatedEventIdsDelayMs > 0) {
      await delay(currentMockRelatedEventIdsDelayMs)
    }
    return HttpResponse.json({
      data: { relatedEventIds: currentMockRelatedEventGroups },
    })
  }),
  api.query("getMySubscriptions", () => {
    return HttpResponse.json({
      data: {
        mySubscriptions: currentMockSubscriptions,
      },
    })
  }),
  api.mutation("SubscribeToAccount", ({ variables }) => {
    const { input } = variables as any
    // Reflect the new subscription so the post-mutation ["getMySubscriptions"]
    // refetch (triggered by the wrapper's invalidateQueries) actually shows
    // the account as subscribed, matching real backend behavior.
    currentMockSubscriptions = [
      ...currentMockSubscriptions,
      { id: `sub_${input.accountId}`, account: { accountId: input.accountId } },
    ]
    return HttpResponse.json({
      data: {
        subscribeToAccount: {
          accountId: input.accountId,
          platform: input.platform,
          username: input.username,
          displayName: input.displayName,
        }
      }
    })
  }),
  api.mutation("removeSubscription", ({ variables }) => {
    const { id } = variables as any
    // Reflect the removal so the post-mutation ["getMySubscriptions"] refetch
    // actually shows the account as no longer subscribed.
    currentMockSubscriptions = currentMockSubscriptions.filter((s) => s.id !== id)
    return HttpResponse.json({
      data: {
        removeSubscription: {
          id,
        }
      }
    })
  }),
  api.mutation("toggleFavorite", ({ variables }) => {
    const { eventId } = variables as any
    if (eventId === "evt_fail") {
      return HttpResponse.json({ errors: [{ message: "Mutation failed" }] })
    }
    if (eventId === "evt_null_data") {
      // Simulates a 200 response whose data.toggleFavorite is unexpectedly null
      // (e.g. a resolver/codegen mismatch), with no top-level `errors` array --
      // the exact shape BUG-009's guard defends against.
      return HttpResponse.json({ data: { toggleFavorite: null } })
    }
    return HttpResponse.json({
      data: {
        toggleFavorite: {
          eventId,
          isFavorited: true,
          favoriteCount: mockToggleFavoriteCount,
        },
      },
    })
  }),
  api.mutation("toggleCalendarAddition", ({ variables }) => {
    const { eventId, scheduleId } = variables as any
    if (scheduleId === "sched_fail") {
      return HttpResponse.json({ errors: [{ message: "Mutation failed" }] })
    }
    if (scheduleId === "sched_null_data") {
      return HttpResponse.json({ data: { toggleCalendarAddition: null } })
    }
    return HttpResponse.json({
      data: {
        toggleCalendarAddition: {
          eventId,
          scheduleId,
          isAddedToCalendar: true,
        },
      },
    })
  }),
  api.mutation("submitReport", ({ variables }) => {
    const { eventId, reason } = variables as any
    return HttpResponse.json({
      data: {
        submitReport: {
          id: "rep_123",
          reason,
          status: "pending",
          createdAt: "2026-08-11T12:00:00Z",
        },
      },
    })
  }),
  api.mutation("resolveScheduleTimezone", ({ variables }) => {
    const { scheduleId, timezone } = variables as any
    if (!timezone || timezone === "invalid") {
      return HttpResponse.json({ errors: [{ message: "Invalid timezone" }] })
    }
    return HttpResponse.json({
      data: {
        resolveScheduleTimezone: {
          scheduleId,
          timezone,
          timezoneStatus: "RESOLVED",
        },
      },
    })
  }),
  api.query("me", () => {
    return HttpResponse.json({
      data: {
        me: {
          id: "u_1",
          email: "test@example.com",
          role: currentMockMeRole,
        },
      },
    })
  }),
]

const server = setupServer()

describe("EventDetailWrapper", () => {
  let queryClient: QueryClient

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    server.use(...handlers)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    capturedEventDetailViewProps = null
    mockSession = { user: { id: "u_1" } } // Default authenticated
    currentMockSubscriptions = []
    currentMockMeRole = "user"
    mockSearchParams = new URLSearchParams()
    mockToggleFavoriteCount = 42
    currentMockEmbedBySlugResult = { status: "NOT_RESOLVABLE_FROM_SLUG", html: null, durableImageUrl: null }
    currentMockEmbedForEventResult = null
    currentMockEmbedForEventDelayMs = 0
    mockGetInstagramEmbedForEventHandler.mockClear()
    currentMockRelatedEventGroups = []
    currentMockRelatedEventIdsDelayMs = 0
    mockGetRelatedEventIdsHandler.mockClear()
    intersectionObserverInstances.length = 0
    currentMockEvent = {
      id: "evt_1",
      eventName: "Test Event",
      slug: "test-event",
      description: "Description",
      location: "Test Location",
      types: [],
      categories: [],
      imageUrl: null,
      durableImageUrl: null,
      videoUrl: null,
      sourcePostUrl: null,
      originalPostUrl: null,
      isFavorited: false,
      favoriteCount: 3,
      isHiddenForCurrentUser: false,
      sourceSocialMediaAccountProfile: null,
      coauthors: [],
      sourcePosts: [],
      schedules: [
        {
          id: "sched_1",
          isMainSchedule: true,
          eventStartDate: "2026-08-10T10:00:00Z",
          eventEndDate: null,
          eventStartTime: null,
          eventEndTime: null,
          timezone: null,
          timezoneStatus: "NEEDS_CLARIFICATION",
          performers: [],
          location: "Stage 1",
          locationDetails: null,
          ticketPrice: null,
          ticketUrl: null,
          registrationUrl: null,
          isAddedToCalendar: false,
        },
        {
          id: "sched_2",
          isMainSchedule: false,
          eventStartDate: "2026-08-11T14:00:00Z",
          eventEndDate: null,
          eventStartTime: null,
          eventEndTime: null,
          timezone: "UTC",
          timezoneStatus: "RESOLVED",
          performers: [],
          location: "Stage 2",
          locationDetails: null,
          ticketPrice: null,
          ticketUrl: null,
          registrationUrl: null,
          isAddedToCalendar: true,
        }
      ] as any,
    }
    mockPosthogCapture.mockClear()
    mockRouterReplace.mockClear()
    mockRouterPush.mockClear()
    mockRouterPrefetch.mockClear()
  })

  afterEach(() => {
    server.resetHandlers()
    queryClient.clear()
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  const renderComponent = () => {
    return render(
      <NuqsTestingAdapter>
        <QueryClientProvider client={queryClient}>
          <EventDetailWrapper slug="test-event" />
        </QueryClientProvider>
      </NuqsTestingAdapter>
    )
  }

  it("renders event details and handles optimistic favorite toggle for authenticated users", async () => {
    renderComponent()

    // Wait for data to load
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    
    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })
    expect(favBtn).toHaveAttribute("aria-pressed", "false")

    // Click to favorite
    fireEvent.click(favBtn)

    // Optimistic UI updates aria-pressed immediately to true
    await waitFor(() => {
      expect(favBtn).toHaveAttribute("aria-pressed", "true")
    })

    // Wait for analytics to be called on success
    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_favorited", expect.objectContaining({
        eventId: "evt_1",
      }))
    })

    // Success message is announced
    expect(screen.getByText("EventDetailsPage.favoriteSuccessAnnouncement")).toBeInTheDocument()
  })

  it("renders the InstagramEmbed path when the slug-based query resolves AVAILABLE (Story 3.7i)", async () => {
    currentMockEmbedBySlugResult = {
      status: "AVAILABLE",
      html: "<blockquote class='instagram-media'>post</blockquote>",
      durableImageUrl: null,
    }

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "EventDetailsPage.embedRegionLabel" })).toBeInTheDocument()

    // AC3 -- proves the legacy-fallback hook stays disabled on the happy path, mirroring
    // Story 3.7h's own "AVAILABLE never joins" proof one layer up the stack.
    expect(mockGetInstagramEmbedForEventHandler).not.toHaveBeenCalled()
  })

  it("renders InstagramEmbed's own unavailable state (not the plain EventImage) when the slug-based query resolves UNAVAILABLE with no fallback (Story 3.7i)", async () => {
    // `instagramEmbedStatus` is still truthy ('UNAVAILABLE'), so EventDetailView's
    // `instagramEmbedStatus ? <InstagramEmbed/> : <EventImage/>` branch (unchanged by this
    // story, AC2) renders InstagramEmbed's own "content no longer available" region -- it
    // is a resolved status, not the "no resolved embed" case AC4 governs (see the next test).
    currentMockEmbedBySlugResult = { status: "UNAVAILABLE", html: null, durableImageUrl: null }
    currentMockEvent = {
      ...currentMockEvent,
      imageUrl: "https://example.com/evt.jpg",
    }

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    const region = screen.getByRole("region", { name: "EventDetailsPage.embedRegionLabel" })
    expect(region).toBeInTheDocument()
    expect(within(region).getByText("EventDetailsPage.contentNoLongerAvailableLabel")).toBeInTheDocument()
  })

  it("renders the plain EventImage path when the merged embed result is unresolved (AC4 regression guard, Story 3.7i)", async () => {
    // Default beforeEach state: embedBySlug resolves NOT_RESOLVABLE_FROM_SLUG and the
    // fallback query resolves with no instagramEmbed data -- resolvedInstagramEmbed stays
    // null, so mapGraphQLEventToDetailViewProps's new parameter must never crash or
    // synthesize a guessed status (AC4), and the existing EventImage path renders unchanged.
    currentMockEvent = {
      ...currentMockEvent,
      imageUrl: "https://example.com/evt.jpg",
    }

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "EventDetailsPage.embedRegionLabel" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Test Event" })).toHaveAttribute("src", "https://example.com/evt.jpg")
  })

  it("falls back to the legacy per-event embed query when the slug-based query resolves NOT_RESOLVABLE_FROM_SLUG, without gating primary content on it (Story 3.7i AC1/AC3)", async () => {
    currentMockEmbedBySlugResult = { status: "NOT_RESOLVABLE_FROM_SLUG", html: null, durableImageUrl: null }
    currentMockEmbedForEventResult = { status: "AVAILABLE", html: "<blockquote>fallback embed</blockquote>", durableImageUrl: null }
    currentMockEmbedForEventDelayMs = 50

    renderComponent()

    // Primary content (the event heading) renders before the delayed fallback response
    // resolves -- proves AC1: primary content never gates on the fallback round trip.
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "EventDetailsPage.embedRegionLabel" })).not.toBeInTheDocument()

    // The embed region eventually appears once the delayed fallback resolves -- proves AC3.
    expect(await screen.findByRole("region", { name: "EventDetailsPage.embedRegionLabel" })).toBeInTheDocument()
  })

  it("patches list caches (events, events/feed, favoriteEvents) when toggle favorite succeeds, using the server-supplied favoriteCount directly (not double-counted, no local ± 1 arithmetic -- BUG-008)", async () => {
    // events/feed's query key is a PREFIX-match of events's (["events", "feed", ...]
    // vs ["events", ...]), so a naive extra patch call targeting ["events", "feed"]
    // on top of ["events"] would double-apply the favoriteCount delta to this cache.
    // The mock's mutation response deliberately does NOT match "old + 1" for any of
    // the seeded caches below, so a stray ±1 computation anywhere in this file would
    // make this assertion fail.
    mockToggleFavoriteCount = 99
    queryClient.setQueryData(["events"], {
      pages: [{ events: { items: [{ id: "evt_1", isFavorited: false, favoriteCount: 5 }] } }],
    })
    queryClient.setQueryData(["events", "feed"], {
      pages: [{ events: { items: [{ id: "evt_1", isFavorited: false, favoriteCount: 5 }] } }],
    })
    queryClient.setQueryData(["favoriteEvents"], {
      pages: [{ events: { items: [{ id: "evt_1", isFavorited: false, favoriteCount: 5 }] } }],
    })

    renderComponent()
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })

    fireEvent.click(favBtn)

    await waitFor(() => {
      const eventsCache = queryClient.getQueryData<any>(["events"])
      expect(eventsCache?.pages[0].events.items[0].isFavorited).toBe(true)
      expect(eventsCache?.pages[0].events.items[0].favoriteCount).toBe(99)

      const feedCache = queryClient.getQueryData<any>(["events", "feed"])
      expect(feedCache?.pages[0].events.items[0].isFavorited).toBe(true)
      expect(feedCache?.pages[0].events.items[0].favoriteCount).toBe(99)

      const favCache = queryClient.getQueryData<any>(["favoriteEvents"])
      expect(favCache?.pages[0].events.items[0].isFavorited).toBe(true)
      expect(favCache?.pages[0].events.items[0].favoriteCount).toBe(99)

      // The detail page's own cache (currentMockEvent starts at favoriteCount: 3)
      // must also reflect the same server-supplied value, or the count next to the
      // heart would silently go stale after the user's own toggle on this exact page.
      const detailCache = queryClient.getQueryData<any>(["getEventBySlug", { slug: "test-event" }])
      expect(detailCache?.eventBySlug?.isFavorited).toBe(true)
      expect(detailCache?.eventBySlug?.favoriteCount).toBe(99)
    })
  })

  it("reflects the server-supplied favoriteCount on the rendered badge rather than a locally-computed ±1 (AC3/BUG-008)", async () => {
    // currentMockEvent starts at favoriteCount: 3; a naive ±1 computation would show
    // 4 after one favorite toggle. The mock mutation instead returns 42 -- proving
    // EventDetailWrapper reads data.toggleFavorite.favoriteCount directly.
    mockToggleFavoriteCount = 42

    renderComponent()
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })
    expect(await screen.findByText("3")).toBeInTheDocument()

    fireEvent.click(favBtn)

    await waitFor(() => {
      expect(favBtn).toHaveAttribute("aria-pressed", "true")
    })

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument()
    })
    expect(screen.queryByText("4")).not.toBeInTheDocument()
  })

  it("redirects unauthenticated users to /login and does not fire mutation", async () => {
    mockSession = null
    
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    
    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })
    fireEvent.click(favBtn)

    // Verify router pushed to login
    expect(mockRouterPush).toHaveBeenCalledWith("/login")
    
    // UI remains unfavorited (no optimistic update)
    expect(favBtn).toHaveAttribute("aria-pressed", "false")
    expect(mockPosthogCapture).not.toHaveBeenCalledWith("event_favorited", expect.anything())
  })

  it("rolls back optimistic update and shows error on mutation failure", async () => {
    currentMockEvent.id = "evt_fail"
    
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    
    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })
    
    // Click to favorite
    fireEvent.click(favBtn)

    // Error message is announced
    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.favoriteErrorAnnouncement")).toBeInTheDocument()
    })
  })

  it("rolls back optimistic update and shows error when toggleFavorite succeeds with null data (BUG-009)", async () => {
    currentMockEvent.id = "evt_null_data"

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const favBtn = await screen.findByRole("button", { name: "EventDetailsPage.favoriteButtonLabel" })
    fireEvent.click(favBtn)

    // Optimistic flip is rolled back and the error path is surfaced, exactly like a
    // genuine mutation failure -- rather than crashing or leaving the UI stuck showing
    // an unconfirmed favorited state.
    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.favoriteErrorAnnouncement")).toBeInTheDocument()
    })
    expect(favBtn).toHaveAttribute("aria-pressed", "false")
  })

  it('uses favorites list context for next navigation when opened from favorites', async () => {
    mockSearchParams = new URLSearchParams('fromList=favorites&favoriteIds=evt_1,evt_2');

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Test Event' })).toBeInTheDocument();

    const nextButton = await screen.findByRole('button', { name: 'EventDetailsPage.next' });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/events/second-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2'
      );
    });
  })

  it("handles add to calendar flow: toggles only changed, triggers ICS download and analytics", async () => {
    const assignMock = vi.fn()
    vi.stubGlobal("location", { assign: assignMock })

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Sched 1 is currently not added, Sched 2 is already added -- invoke the
    // captured onAddToCalendar prop directly (Story 1.6f Task 7) with both ids
    // selected, matching the old dialog interaction of checking sched_1 while
    // leaving sched_2's already-checked box checked.
    await capturedEventDetailViewProps.onAddToCalendar(["sched_1", "sched_2"])

    // Verify mutation called for sched_1 (changed), but NOT sched_2 (unchanged)
    // Verify download triggered only for sched_1 (transitioned false -> true)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(expect.stringContaining("/api/calendar/ics?eventId=evt_1&scheduleId=sched_1"))
    })

    // Analytics capture
    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_added_to_calendar", {
        eventId: "evt_1",
        scheduleId: "sched_1",
      })
      expect(mockPosthogCapture).toHaveBeenCalledWith("calendar_ics_downloaded", {
        eventId: "evt_1",
        scheduleIds: ["sched_1"],
      })
    })
  })

  it("settles a mixed-outcome multi-schedule confirm per item: dialog stays open, download/analytics scoped to the succeeding id only, no success toast (BUG-007)", async () => {
    const assignMock = vi.fn()
    vi.stubGlobal("location", { assign: assignMock })

    currentMockEvent.schedules = [
      {
        id: "sched_ok",
        isMainSchedule: true,
        eventStartDate: "2026-08-10T10:00:00Z",
        eventEndDate: null,
        eventStartTime: null,
        eventEndTime: null,
        timezone: null,
        ticketPrice: null,
        isAddedToCalendar: false,
      },
      {
        id: "sched_fail",
        isMainSchedule: false,
        eventStartDate: "2026-08-11T14:00:00Z",
        eventEndDate: null,
        eventStartTime: null,
        eventEndTime: null,
        timezone: null,
        ticketPrice: null,
        isAddedToCalendar: false,
      },
    ] as any

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Both schedules selected -- mirrors the old dialog interaction of checking
    // both checkboxes before confirm. Real UI usage (AddToCalendarDialog's
    // handleConfirm) awaits onAddToCalendar inside a try/catch and keeps the
    // dialog open on rejection, so this mirrors that swallow here.
    await capturedEventDetailViewProps.onAddToCalendar(["sched_ok", "sched_fail"]).catch(() => {})

    // Error is announced for the failed schedule
    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.calendarErrorAnnouncement")).toBeInTheDocument()
    })

    // Download/analytics fire, scoped to the succeeding id only -- sched_fail never
    // appears even though it was part of the same confirm.
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(expect.stringContaining("/api/calendar/ics?eventId=evt_1&scheduleId=sched_ok"))
    })
    expect(assignMock).not.toHaveBeenCalledWith(expect.stringContaining("scheduleId=sched_fail"))

    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith("calendar_ics_downloaded", {
        eventId: "evt_1",
        scheduleIds: ["sched_ok"],
      })
    })

    // No success toast on a partial failure -- reuses the existing full-failure
    // messaging path, no new "N of M succeeded" copy.
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("surfaces an error and keeps the dialog open when add to calendar mutation fails", async () => {
    currentMockEvent.schedules = [
      {
        id: "sched_fail",
        isMainSchedule: true,
        eventStartDate: "2026-08-10T10:00:00Z",
        eventEndDate: null,
        eventStartTime: null,
        eventEndTime: null,
        timezone: null,
        ticketPrice: null,
        isAddedToCalendar: false,
      },
    ] as any

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Directly invoke onAddToCalendar (Story 1.6f Task 7) instead of driving the
    // removed button/dialog UI -- real usage swallows the rejection the same way.
    await capturedEventDetailViewProps.onAddToCalendar(["sched_fail"]).catch(() => {})

    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.calendarErrorAnnouncement")).toBeInTheDocument()
    })
  })

  it("surfaces an error and keeps the dialog open when toggleCalendarAddition succeeds with null data (BUG-009)", async () => {
    currentMockEvent.schedules = [
      {
        id: "sched_null_data",
        isMainSchedule: true,
        eventStartDate: "2026-08-10T10:00:00Z",
        eventEndDate: null,
        eventStartTime: null,
        eventEndTime: null,
        timezone: null,
        ticketPrice: null,
        isAddedToCalendar: false,
      },
    ] as any

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Directly invoke onAddToCalendar (Story 1.6f Task 7) instead of driving the
    // removed button/dialog UI.
    await capturedEventDetailViewProps.onAddToCalendar(["sched_null_data"]).catch(() => {})

    // A null-data "success" response must not be mistaken for a real success: no
    // false-success toast, no .ics download (this is the Promise.all/try-catch
    // contract that handleAddToCalendar depends on to know a schedule toggle
    // actually failed).
    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.calendarErrorAnnouncement")).toBeInTheDocument()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("unauthenticated calendar click redirects to /login and does not open dialog", async () => {
    mockSession = null
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Directly invoke onAddToCalendar (Story 1.6f Task 7) instead of driving the
    // removed button/dialog UI -- handleAddToCalendar's own unauthenticated
    // shortcut (redirect, no mutation) is unchanged by Task 6's relocation.
    await capturedEventDetailViewProps.onAddToCalendar(["sched_1"])

    expect(mockRouterPush).toHaveBeenCalledWith("/login")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("unauthenticated correct data click redirects to /login and does not open dialog", async () => {
    mockSession = null
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const moreBtn = await screen.findByRole("button", { name: "EventDetailsPage.moreActionsButtonLabel" })
    fireEvent.click(moreBtn)

    const correctBtn = await screen.findByRole("menuitem", { name: "EventDetailsPage.correctDataMenuItemLabel" })
    fireEvent.click(correctBtn)

    expect(mockRouterPush).toHaveBeenCalledWith("/login")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("unauthenticated report click redirects to /login and does not open dialog", async () => {
    mockSession = null
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const moreBtn = await screen.findByRole("button", { name: "EventDetailsPage.moreActionsButtonLabel" })
    fireEvent.click(moreBtn)

    const reportBtn = await screen.findByRole("menuitem", { name: "EventDetailsPage.reportMenuItemLabel" })
    fireEvent.click(reportBtn)

    expect(mockRouterPush).toHaveBeenCalledWith("/login")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // Story 1.6f Task 8 (AC3): badge click navigates to Discovery with exactly
  // one facet param -- no existing searchParams carried over.
  it("clicking a category badge calls router.push with exactly /?categories=<value>, not carrying over existing searchParams", async () => {
    currentMockEvent.categories = ["MUSIC"] as any
    mockSearchParams = new URLSearchParams("q=some-search&types=WORKSHOP")
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const categoryBtn = await screen.findByRole("button", { name: "EventCategory.MUSIC" })
    fireEvent.click(categoryBtn)

    expect(mockRouterPush).toHaveBeenCalledWith("/?categories=MUSIC")
    expect(mockRouterPush).toHaveBeenCalledTimes(1)
  })

  it("clicking a type badge calls router.push with exactly /?types=<value>, not carrying over existing searchParams", async () => {
    currentMockEvent.types = ["FESTIVAL"] as any
    mockSearchParams = new URLSearchParams("q=some-search&categories=MUSIC")
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const typeBtn = await screen.findByRole("button", { name: "EventType.FESTIVAL" })
    fireEvent.click(typeBtn)

    expect(mockRouterPush).toHaveBeenCalledWith("/?types=FESTIVAL")
    expect(mockRouterPush).toHaveBeenCalledTimes(1)
  })

  it("renders the hidden empty state if isHiddenForCurrentUser is true", async () => {
    currentMockEvent.isHiddenForCurrentUser = true as any
    renderComponent()

    // Wait for empty state title
    expect(await screen.findByRole("heading", { name: "EventDetailsPage.hiddenAfterReportTitle" })).toBeInTheDocument()
    expect(screen.getByText("EventDetailsPage.hiddenAfterReportBody")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Test Event" })).not.toBeInTheDocument()
  })

  it("renders the hidden empty state immediately after successful report submission without full page reload", async () => {
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const moreBtn = await screen.findByRole("button", { name: "EventDetailsPage.moreActionsButtonLabel" })
    fireEvent.click(moreBtn)

    const reportBtn = await screen.findByRole("menuitem", { name: "EventDetailsPage.reportMenuItemLabel" })
    fireEvent.click(reportBtn)

    // Verify dialog opened
    expect(await screen.findByRole("heading", { name: "EventReportForm.dialogTitle" })).toBeInTheDocument()

    // Select personal
    const personalRadio = document.getElementById("reason-personal") as HTMLButtonElement
    fireEvent.click(personalRadio)

    const form = document.querySelector("form")
    expect(form).toBeInTheDocument()
    fireEvent.submit(form!)

    // Verify it transitions to hidden empty state
    expect(await screen.findByRole("heading", { name: "EventDetailsPage.hiddenAfterReportTitle" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Test Event" })).not.toBeInTheDocument()
  })

  it("renders Carousel layout structure and supports button-click navigation", async () => {
    mockSearchParams = new URLSearchParams("fromList=favorites&favoriteIds=evt_1,evt_2")
    renderComponent()

    // Verify Carousel container region exists
    const carouselRegion = await screen.findByRole("region")
    expect(carouselRegion).toBeInTheDocument()
    expect(carouselRegion).toHaveAttribute("aria-roledescription", "carousel")

    const prevButton = await screen.findByRole("button", { name: "EventDetailsPage.previous" })
    const nextButton = await screen.findByRole("button", { name: "EventDetailsPage.next" })

    expect(prevButton).toBeInTheDocument()
    expect(nextButton).toBeInTheDocument()

    // Click next calls replace
    fireEvent.click(nextButton)
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        "/events/second-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2"
      )
    })
  })

  it("renders card-level peek previews with the real list-item image on both sides, and none when a direction is disabled", async () => {
    // Current event (evt_2) sits in the middle of a 3-item favorites list, so both
    // a previous peek (evt_1) and a next peek (evt_3) should render.
    currentMockEvent.id = "evt_2"
    currentMockEvent.slug = "second-event"
    currentMockEvent.eventName = "Second Event"
    mockSearchParams = new URLSearchParams("fromList=favorites&favoriteIds=evt_1,evt_2,evt_3")

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Second Event" })).toBeInTheDocument()

    // Two decorative peek images (evt_1 has none, evt_3 does) plus none for evt_1 itself.
    const peekImages = await screen.findAllByRole("img", { hidden: true })
    const peekSrcs = peekImages.map((img) => (img as HTMLImageElement).src)
    expect(peekSrcs).toContain("https://example.com/evt3.jpg")

    // Only real content ("Second Event") is a heading — peek cards carry no real text.
    expect(screen.queryByText("Test Event")).not.toBeInTheDocument()
    expect(screen.queryByText("Third Event")).not.toBeInTheDocument()

    // Both known adjacent targets are prefetched so a committed Next/Previous
    // navigation resolves before the route-level RouteLoader fallback can show.
    await waitFor(() => {
      expect(mockRouterPrefetch).toHaveBeenCalledWith(
        "/events/test-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2%2Cevt_3"
      )
      expect(mockRouterPrefetch).toHaveBeenCalledWith(
        "/events/third-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2%2Cevt_3"
      )
    })
  })

  it("renders no peek preview when there is no list context (deep link)", async () => {
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // No list context => no Carousel chrome, no peek images at all.
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()

    // Nothing to prefetch either — a genuine cold/direct-URL open has no known
    // adjacent target, so the route-level RouteLoader is expected here.
    expect(mockRouterPrefetch).not.toHaveBeenCalled()
  })

  it("renders timezone clarification indicator for NEEDS_CLARIFICATION schedule", async () => {
    currentMockMeRole = "moderator"
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // The first schedule (sched_1) has NEEDS_CLARIFICATION, should render indicator
    const timezoneLabel = await screen.findByText("EventDetailsPage.timezoneClarificationLabel")
    expect(timezoneLabel).toBeInTheDocument()
  })

  it("does not render timezone clarification indicator for RESOLVED schedule", async () => {
    currentMockMeRole = "moderator"
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Should render twice (once for each schedule), but second one (sched_2) should not have it
    const clarificationLabels = screen.queryAllByText("EventDetailsPage.timezoneClarificationLabel")
    expect(clarificationLabels).toHaveLength(1) // Only first schedule
  })

  it("never shows the timezone prompt to a non-moderator (user or anonymous)", async () => {
    renderComponent()
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    expect(screen.queryByText("EventDetailsPage.timezoneClarificationLabel")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("EventDetailsPage.timezoneSelectPlaceholder")).not.toBeInTheDocument()
  })

  it("authenticated timezone submit calls mutation and shows success message", async () => {
    currentMockMeRole = "moderator"
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const timezoneInput = await screen.findByPlaceholderText("EventDetailsPage.timezoneSelectPlaceholder") as HTMLInputElement
    fireEvent.change(timezoneInput, { target: { value: "America/New_York" } })

    const submitButton = await screen.findByRole("button", { name: "EventDetailsPage.timezoneSubmitLabel" })
    fireEvent.click(submitButton)

    // Optimistic update should show success announcement in live region
    const liveRegion = document.querySelector('[aria-live="polite"]')
    await waitFor(() => {
      expect(liveRegion?.textContent).toContain("EventDetailsPage.timezoneSubmitSuccessAnnouncement")
    })
  })

  it("timezone submit failure shows error message and rolls back optimistic update", async () => {
    currentMockMeRole = "moderator"
    // Override handler for this test to return error
    server.use(
      graphql.link("*/api/graphql").mutation("resolveScheduleTimezone", () => {
        return HttpResponse.json({ errors: [{ message: "Mutation failed" }] })
      })
    )

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const timezoneInput = await screen.findByPlaceholderText("EventDetailsPage.timezoneSelectPlaceholder") as HTMLInputElement
    fireEvent.change(timezoneInput, { target: { value: "America/New_York" } })

    const submitButton = await screen.findByRole("button", { name: "EventDetailsPage.timezoneSubmitLabel" })
    fireEvent.click(submitButton)

    // Error message should appear in live region
    const liveRegion = document.querySelector('[aria-live="polite"]')
    await waitFor(() => {
      expect(liveRegion?.textContent).toContain("EventDetailsPage.timezoneSubmitErrorAnnouncement")
    })
  })

  it("renders a video when videoUrl is provided", async () => {
    currentMockEvent.videoUrl = "https://example.com/video.mp4"

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const videoEl = screen.getByTestId("event-video") as HTMLVideoElement
    expect(videoEl).toBeInTheDocument()
    expect(videoEl).toHaveAttribute("src", "https://example.com/video.mp4")
  })

  it("swaps image source to durableImageUrl when imageUrl fails to load", async () => {
    currentMockEvent.imageUrl = "https://example.com/original.jpg"
    currentMockEvent.durableImageUrl = "https://example.com/durable.jpg"

    renderComponent()

    // Wait for the event to load and find the image
    const img = await screen.findByRole("img", { name: "Test Event" })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "https://example.com/original.jpg")

    // Fire error on the img element to trigger fallback
    fireEvent.error(img)

    // Assert that the img src has changed to the durableImageUrl
    expect(img).toHaveAttribute("src", "https://example.com/durable.jpg")
  })

  it("renders SubscribedAccountCard with a not-subscribed toggle when not subscribed to the source account", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = []

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    expect(screen.getByText("Org")).toBeInTheDocument()
    // Story 1.6c (AC5) — getMySubscriptions is now gated on eventBySlug's own data (it only
    // starts once sourceSocialMediaAccountProfile is known), so the toggle briefly renders in
    // its neutral/checking state before this resolves; wait for the settled state instead of
    // asserting synchronously right after the heading appears.
    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "false")
    })
  })

  it("clicking the toggle calls the subscribe mutation and updates to the subscribed state on success", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = []

    renderComponent()

    // Story 1.6c (AC5) — see the identical comment in the preceding test: wait for the
    // now-gated getMySubscriptions query to settle before asserting/clicking the toggle.
    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "false")
    })
    const toggle = screen.getByTestId("subscribe-toggle")
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.subscribeSuccessAnnouncement")).toBeInTheDocument()
    })

    // The card itself must reflect the change too, not just the
    // announcement -- driven by the ["getMySubscriptions"] refetch the
    // mutation's onSuccess triggers.
    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "true")
    })

    expect(mockPosthogCapture).toHaveBeenCalledWith("account_subscribed", { eventId: "evt_1", accountId: "123" })
  })

  it("shows the subscribed toggle state when already subscribed to the source account", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = [{ id: "sub_123", account: { accountId: "123" } }]

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "true")
    })
  })

  it("clicking the toggle while subscribed calls removeSubscription and flips back to not-subscribed on success", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = [{ id: "sub_123", account: { accountId: "123" } }]

    renderComponent()

    const toggle = await screen.findByTestId("subscribe-toggle")
    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-pressed", "true")
    })

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.unsubscribeSuccessAnnouncement")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "false")
    })

    expect(mockPosthogCapture).toHaveBeenCalledWith("account_unsubscribed", { eventId: "evt_1", accountId: "123" })
  })

  it("shows the neutral/checking state (not the not-subscribed icon) while getMySubscriptions is still loading for an already-subscribed user (DW-009 regression)", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = [{ id: "sub_123", account: { accountId: "123" } }]

    server.use(
      api.query("getMySubscriptions", async () => {
        // Deliberately delay resolution so the render can be observed mid-flight.
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({
          data: {
            mySubscriptions: currentMockSubscriptions,
          },
        })
      })
    )

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // While the subscriptions query is still in flight, the toggle must show the
    // neutral/checking state -- never the not-subscribed (aria-pressed=false) icon.
    const toggle = screen.getByTestId("subscribe-toggle")
    expect(toggle).not.toHaveAttribute("aria-pressed")
    expect(toggle).toHaveAttribute("aria-busy", "true")

    await waitFor(() => {
      expect(screen.getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "true")
    })
  })

  it("does NOT invoke getMySubscriptions when the event has no linked source account (Story 1.6c AC5, FIND-030)", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = null

    const mySubscriptionsSpy = vi.fn(() =>
      HttpResponse.json({ data: { mySubscriptions: currentMockSubscriptions } })
    )
    server.use(api.query("getMySubscriptions", mySubscriptionsSpy))

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Give any would-be in-flight request a chance to land before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(mySubscriptionsSpy).not.toHaveBeenCalled()
  })

  it("DOES invoke getMySubscriptions when the event has a linked source account and a session (Story 1.6c AC5, FIND-030)", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }

    const mySubscriptionsSpy = vi.fn(() =>
      HttpResponse.json({ data: { mySubscriptions: currentMockSubscriptions } })
    )
    server.use(api.query("getMySubscriptions", mySubscriptionsSpy))

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    await waitFor(() => {
      expect(mySubscriptionsSpy).toHaveBeenCalled()
    })
  })

  describe("coauthor subscribe/unsubscribe toggles (Story 0.i6g)", () => {
    const coauthorA = {
      accountId: "coauthor-a",
      platform: "instagram",
      username: "coauthor_a",
      displayName: "Coauthor A",
      profileImageUrl: null,
    }
    const coauthorB = {
      accountId: "coauthor-b",
      platform: "instagram",
      username: "coauthor_b",
      displayName: "Coauthor B",
      profileImageUrl: null,
    }

    it("renders two coauthors as two SubscribedAccountCards", async () => {
      currentMockEvent.coauthors = [coauthorA, coauthorB]

      renderComponent()

      const list = await screen.findByRole("list", { name: "EventDetailsPage.coauthorsListAriaLabel" })
      await waitFor(() => {
        expect(within(list).getAllByTestId("subscribe-toggle")).toHaveLength(2)
      })
    })

    it("subscribing to coauthor A calls subscribeToAccount with coauthor A's own platform/accountId/username/displayName, and on success flips only that row -- the other coauthor's and the source account's toggle state is unaffected", async () => {
      currentMockEvent.sourceSocialMediaAccountProfile = {
        accountId: "123",
        platform: "instagram",
        username: "org",
        displayName: "Org",
        profileImageUrl: null,
      }
      currentMockEvent.coauthors = [coauthorA, coauthorB]
      currentMockSubscriptions = []

      let capturedSubscribeInput: any = null
      server.use(
        api.mutation("SubscribeToAccount", ({ variables }) => {
          const { input } = variables as any
          capturedSubscribeInput = input
          currentMockSubscriptions = [
            ...currentMockSubscriptions,
            { id: `sub_${input.accountId}`, account: { accountId: input.accountId } },
          ]
          return HttpResponse.json({
            data: {
              subscribeToAccount: { ...input },
            },
          })
        })
      )

      renderComponent()

      const list = await screen.findByRole("list", { name: "EventDetailsPage.coauthorsListAriaLabel" })
      await waitFor(() => {
        expect(within(list).getAllByTestId("subscribe-toggle")).toHaveLength(2)
      })
      const items = within(list).getAllByRole("listitem")
      const toggleA = within(items[0]).getByTestId("subscribe-toggle")
      const toggleB = within(items[1]).getByTestId("subscribe-toggle")

      await waitFor(() => {
        expect(toggleA).toHaveAttribute("aria-pressed", "false")
        expect(toggleB).toHaveAttribute("aria-pressed", "false")
      })

      fireEvent.click(toggleA)

      await waitFor(() => {
        expect(capturedSubscribeInput).toEqual({
          platform: "instagram",
          accountId: "coauthor-a",
          username: "coauthor_a",
          displayName: "Coauthor A",
        })
      })

      await waitFor(() => {
        expect(within(items[0]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "true")
      })
      // Coauthor B and the source account toggle are unaffected.
      expect(within(items[1]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "false")
      const sourceToggle = screen.getAllByTestId("subscribe-toggle")[0]
      expect(sourceToggle).toHaveAttribute("aria-pressed", "false")
    })

    it("unsubscribing calls removeSubscription with that coauthor's own matched subscription id", async () => {
      currentMockEvent.coauthors = [coauthorA, coauthorB]
      currentMockSubscriptions = [
        { id: "sub_coauthor-a", account: { accountId: "coauthor-a" } },
        { id: "sub_coauthor-b", account: { accountId: "coauthor-b" } },
      ]

      let capturedRemoveId: string | null = null
      server.use(
        api.mutation("removeSubscription", ({ variables }) => {
          const { id } = variables as any
          capturedRemoveId = id
          currentMockSubscriptions = currentMockSubscriptions.filter((s) => s.id !== id)
          return HttpResponse.json({ data: { removeSubscription: { id } } })
        })
      )

      renderComponent()

      const list = await screen.findByRole("list", { name: "EventDetailsPage.coauthorsListAriaLabel" })
      const items = within(list).getAllByRole("listitem")
      const toggleB = within(items[1]).getByTestId("subscribe-toggle")

      await waitFor(() => {
        expect(toggleB).toHaveAttribute("aria-pressed", "true")
      })

      fireEvent.click(toggleB)

      await waitFor(() => {
        expect(capturedRemoveId).toBe("sub_coauthor-b")
      })
      await waitFor(() => {
        expect(within(items[1]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "false")
      })
    })

    it("clicking coauthor A's toggle while coauthor B's mutation is still in flight shows A as busy and B unaffected (AC6)", async () => {
      currentMockEvent.coauthors = [coauthorA, coauthorB]
      currentMockSubscriptions = []

      server.use(
        api.mutation("SubscribeToAccount", async ({ variables }) => {
          const { input } = variables as any
          await delay(50)
          currentMockSubscriptions = [
            ...currentMockSubscriptions,
            { id: `sub_${input.accountId}`, account: { accountId: input.accountId } },
          ]
          return HttpResponse.json({ data: { subscribeToAccount: { ...input } } })
        })
      )

      renderComponent()

      const list = await screen.findByRole("list", { name: "EventDetailsPage.coauthorsListAriaLabel" })
      const items = within(list).getAllByRole("listitem")
      const toggleA = within(items[0]).getByTestId("subscribe-toggle")
      const toggleB = within(items[1]).getByTestId("subscribe-toggle")

      await waitFor(() => {
        expect(toggleA).toHaveAttribute("aria-pressed", "false")
      })

      fireEvent.click(toggleA)

      // While A's mutation is in flight, A shows busy; B is unaffected (not busy).
      await waitFor(() => {
        expect(within(items[0]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-busy", "true")
      })
      expect(within(items[1]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-busy", "false")

      await waitFor(() => {
        expect(within(items[0]).getByTestId("subscribe-toggle")).toHaveAttribute("aria-pressed", "true")
      })
    })

    it("never calls posthog.capture for a coauthor subscribe/unsubscribe (AC9), while the existing source-account account_subscribed/account_unsubscribed assertions remain unaffected", async () => {
      currentMockEvent.coauthors = [coauthorA]
      currentMockSubscriptions = []

      renderComponent()

      const list = await screen.findByRole("list", { name: "EventDetailsPage.coauthorsListAriaLabel" })
      const toggle = within(list).getByTestId("subscribe-toggle")

      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-pressed", "false")
      })

      fireEvent.click(toggle)

      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-pressed", "true")
      })

      expect(mockPosthogCapture).not.toHaveBeenCalledWith("account_subscribed", expect.anything())
      expect(mockPosthogCapture).not.toHaveBeenCalledWith("account_unsubscribed", expect.anything())

      fireEvent.click(toggle)

      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-pressed", "false")
      })

      expect(mockPosthogCapture).not.toHaveBeenCalledWith("account_subscribed", expect.anything())
      expect(mockPosthogCapture).not.toHaveBeenCalledWith("account_unsubscribed", expect.anything())
    })

    it("DOES invoke getMySubscriptions when the event has coauthors but no sourceSocialMediaAccountProfile (AC11)", async () => {
      currentMockEvent.sourceSocialMediaAccountProfile = null
      currentMockEvent.coauthors = [coauthorA]

      const mySubscriptionsSpy = vi.fn(() =>
        HttpResponse.json({ data: { mySubscriptions: currentMockSubscriptions } })
      )
      server.use(api.query("getMySubscriptions", mySubscriptionsSpy))

      renderComponent()

      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
      await waitFor(() => {
        expect(mySubscriptionsSpy).toHaveBeenCalled()
      })
    })
  })

  it("registers the Instagram embed.js caching service worker with the current locale's scope (Story 0.38 AC1/AC2, Task 1.5)", async () => {
    const registerSpy = vi.fn().mockResolvedValue({ scope: "/en/events/" })
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: registerSpy },
    })

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith("/instagram-embed-cache-sw.js", {
        scope: "/en/events/",
      })
    })
    // Never the unrelated, root-scoped FCM worker or this project's own
    // same-origin widget-embedding script (AC1's explicit disambiguation).
    expect(registerSpy).not.toHaveBeenCalledWith(
      "/firebase-messaging-sw.js",
      expect.anything()
    )
    expect(registerSpy).not.toHaveBeenCalledWith("/embed.js", expect.anything())
  })

  it("does not throw when 'serviceWorker' is unsupported by the browser (AC1's guard)", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker")
    // The guard is `'serviceWorker' in navigator` — an `in` check, not a
    // truthiness check — so the property key itself must be absent (not just
    // `undefined`-valued) to exercise the unsupported-browser branch.
    // @ts-expect-error -- deliberately deleting a non-optional DOM property for this test
    delete navigator.serviceWorker

    expect(() => renderComponent()).not.toThrow()
    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    if (originalDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", originalDescriptor)
    }
  })

  describe("related events lazy load (Story 3.6u)", () => {
    const triggerSentinelVisible = () => {
      const observer = intersectionObserverInstances[intersectionObserverInstances.length - 1]
      observer.trigger(true)
    }

    it("never fires relatedEventIds/events before the sentinel reports visible, then fires once it does", async () => {
      currentMockEvent.sourcePosts = [
        {
          postId: "post-1",
          isPrimary: true,
          account: { accountId: "acct-1", platform: "instagram", username: "acct_one", displayName: "Acct One", profileImageUrl: null },
        },
      ]
      currentMockRelatedEventGroups = [{ postId: "post-1", eventIds: ["evt_2"] }]

      renderComponent()

      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

      // Not visible yet -- never fired.
      expect(mockGetRelatedEventIdsHandler).not.toHaveBeenCalled()
      expect(capturedEventDetailViewProps.relatedEventGroups).toBeUndefined()

      triggerSentinelVisible()

      await waitFor(() => {
        expect(mockGetRelatedEventIdsHandler).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(capturedEventDetailViewProps.relatedEventGroups).toEqual([
          expect.objectContaining({ postId: "post-1", totalCount: 1 }),
        ])
      })
      expect(capturedEventDetailViewProps.relatedEventGroups[0].events).toEqual([
        expect.objectContaining({ id: "evt_2", slug: "second-event" }),
      ])
    })

    it("never delays or blocks the primary eventBySlug render while the related-events queries are pending", async () => {
      currentMockEvent.sourcePosts = [
        {
          postId: "post-1",
          isPrimary: true,
          account: { accountId: "acct-1", platform: "instagram", username: "acct_one", displayName: "Acct One", profileImageUrl: null },
        },
      ]
      currentMockRelatedEventGroups = [{ postId: "post-1", eventIds: ["evt_2"] }]
      currentMockRelatedEventIdsDelayMs = 50

      renderComponent()

      // The primary heading renders immediately, well before the (delayed) related-events
      // fetch would ever resolve -- it is never awaited/gated on.
      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

      triggerSentinelVisible()

      await waitFor(() => {
        expect(capturedEventDetailViewProps.isRelatedEventsLoading).toBe(true)
      })
      // The primary content is already fully rendered -- isRelatedEventsLoading only governs
      // the Related Events section's own skeleton, never the rest of the page.
      expect(screen.getByRole("heading", { name: "Test Event" })).toBeInTheDocument()

      await waitFor(() => {
        expect(capturedEventDetailViewProps.isRelatedEventsLoading).toBe(false)
      })
    })

    it("labels each group from the already-loaded sourcePosts account data (no second account fetch) and builds the See-all href", async () => {
      currentMockEvent.sourcePosts = [
        {
          postId: "post-1",
          isPrimary: true,
          platformPostId: "ig-post-1",
          postType: "post",
          account: { accountId: "acct-1", platform: "instagram", username: "acct_one", displayName: "Acct One", profileImageUrl: null },
        },
      ]
      currentMockRelatedEventGroups = [{ postId: "post-1", eventIds: ["evt_2", "evt_3"] }]

      renderComponent()
      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

      triggerSentinelVisible()

      await waitFor(() => {
        expect(capturedEventDetailViewProps.relatedEventGroups?.[0]?.events).toHaveLength(2)
      })

      const group = capturedEventDetailViewProps.relatedEventGroups[0]
      expect(group.accountLabel).toBe("EventDetailsPage.relatedEventsGroupLabel")
      expect(group.seeAllHref).toBe("/posts/ig/post/ig-post-1/events")
      expect(group.totalCount).toBe(2)

      // No second account-resolving query was ever registered for this flow -- `getEvents`
      // (the only query the second step fires) never selects account/sourcePosts fields, and
      // this test's handler list has no separate per-account query the label could come from.
      expect(group.events.map((e: any) => e.id).sort()).toEqual(["evt_2", "evt_3"])
    })

    it("heads the group with the post title when the source post has one, falling back to the account label otherwise", async () => {
      currentMockEvent.sourcePosts = [
        {
          postId: "post-1",
          isPrimary: true,
          title: "Weekend Jazz Roundup",
          platformPostId: "ig-post-1",
          postType: "post",
          account: { accountId: "acct-1", platform: "instagram", username: "acct_one", displayName: "Acct One", profileImageUrl: null },
        },
      ]
      currentMockRelatedEventGroups = [{ postId: "post-1", eventIds: ["evt_2"] }]

      renderComponent()
      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
      triggerSentinelVisible()

      await waitFor(() => {
        expect(capturedEventDetailViewProps.relatedEventGroups?.[0]?.events).toHaveLength(1)
      })
      expect(capturedEventDetailViewProps.relatedEventGroups[0].accountLabel).toBe("EventDetailsPage.relatedEventsGroupTitleLabel")
    })

    it("hides the section entirely when relatedEventIds resolves to no groups", async () => {
      currentMockEvent.sourcePosts = []
      currentMockRelatedEventGroups = []

      renderComponent()
      expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

      triggerSentinelVisible()

      await waitFor(() => {
        expect(mockGetRelatedEventIdsHandler).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(capturedEventDetailViewProps.relatedEventGroups).toEqual([])
      })
      // The sentinel wrapper itself always renders (so `useVisibleOnce` has something to
      // observe before any data exists, per EventDetailView's own design), but with zero
      // groups there is nothing to render inside it -- no empty-state placeholder (AC6).
      expect(screen.queryByText("EventDetailsPage.relatedEventsGroupLabel")).not.toBeInTheDocument()
    })
  })
})
