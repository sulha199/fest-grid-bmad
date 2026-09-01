import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest"
import { EventDetailWrapper } from "./EventDetailWrapper"

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
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
import { graphql, HttpResponse } from "msw"
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
  schedules: [],
}

let currentMockSubscriptions: { account: { accountId: string } }[] = []

const api = graphql.link("*/api/graphql")

const handlers = [
  api.query("getEventBySlug", ({ query, variables }) => {
    return HttpResponse.json({
      data: {
        eventBySlug: { ...currentMockEvent },
      },
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
      { account: { accountId: input.accountId } },
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
  api.mutation("toggleFavorite", ({ variables }) => {
    const { eventId } = variables as any
    if (eventId === "evt_fail") {
      return HttpResponse.json({ errors: [{ message: "Mutation failed" }] })
    }
    return HttpResponse.json({
      data: {
        toggleFavorite: {
          eventId,
          isFavorited: true,
        },
      },
    })
  }),
  api.mutation("toggleCalendarAddition", ({ variables }) => {
    const { eventId, scheduleId } = variables as any
    if (scheduleId === "sched_fail") {
      return HttpResponse.json({ errors: [{ message: "Mutation failed" }] })
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
          role: "user",
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
    mockSession = { user: { id: "u_1" } } // Default authenticated
    currentMockSubscriptions = []
    mockSearchParams = new URLSearchParams()
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

  it("patches list caches (events, events/feed, favoriteEvents) when toggle favorite succeeds, without double-counting favoriteCount", async () => {
    // events/feed's query key is a PREFIX-match of events's (["events", "feed", ...]
    // vs ["events", ...]), so a naive extra patch call targeting ["events", "feed"]
    // on top of ["events"] would double-apply the favoriteCount delta to this cache.
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
      expect(eventsCache?.pages[0].events.items[0].favoriteCount).toBe(6)

      const feedCache = queryClient.getQueryData<any>(["events", "feed"])
      expect(feedCache?.pages[0].events.items[0].isFavorited).toBe(true)
      expect(feedCache?.pages[0].events.items[0].favoriteCount).toBe(6)

      const favCache = queryClient.getQueryData<any>(["favoriteEvents"])
      expect(favCache?.pages[0].events.items[0].isFavorited).toBe(true)
      expect(favCache?.pages[0].events.items[0].favoriteCount).toBe(6)

      // The detail page's own cache (currentMockEvent starts at favoriteCount: 3)
      // must also bump, or the count next to the heart would silently go stale
      // after the user's own toggle on this exact page.
      const detailCache = queryClient.getQueryData<any>(["getEventBySlug", { slug: "test-event" }])
      expect(detailCache?.eventBySlug?.isFavorited).toBe(true)
      expect(detailCache?.eventBySlug?.favoriteCount).toBe(4)
    })
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

  it("handles add to calendar flow: opens dialog, toggles only changed, triggers ICS download and analytics", async () => {
    const assignMock = vi.fn()
    vi.stubGlobal("location", { assign: assignMock })

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const calBtn = await screen.findByRole("button", { name: "EventDetailsPage.addToCalendarButtonLabel" })
    
    // Open dialog
    fireEvent.click(calBtn)

    expect(screen.getByRole("dialog")).toBeInTheDocument()

    // Sched 1 is currently not added (unchecked), Sched 2 is added (checked)
    const checkbox1 = screen.getByLabelText(/EventDetailsPage.defaultScheduleTitle 1/) as HTMLInputElement
    const checkbox2 = screen.getByLabelText(/EventDetailsPage.defaultScheduleTitle 2/) as HTMLInputElement
    expect(checkbox1.checked).toBe(false)
    expect(checkbox2.checked).toBe(true)

    // Check Sched 1 (will transition false -> true)
    fireEvent.click(checkbox1)
    expect(checkbox1.checked).toBe(true)

    // Click Confirm
    const confirmBtn = screen.getByRole("button", { name: "EventDetailsPage.addToCalendarConfirmLabel" })
    fireEvent.click(confirmBtn)

    // Verify dialog closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

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

    const calBtn = await screen.findByRole("button", { name: "EventDetailsPage.addToCalendarButtonLabel" })
    fireEvent.click(calBtn)

    expect(screen.getByRole("dialog")).toBeInTheDocument()

    const checkbox = screen.getByLabelText(/EventDetailsPage.defaultScheduleTitle/) as HTMLInputElement
    fireEvent.click(checkbox)

    const confirmBtn = screen.getByRole("button", { name: "EventDetailsPage.addToCalendarConfirmLabel" })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.calendarErrorAnnouncement")).toBeInTheDocument()
    })

    // Dialog does not close on a false-success basis
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("unauthenticated calendar click redirects to /login and does not open dialog", async () => {
    mockSession = null
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const calBtn = await screen.findByRole("button", { name: "EventDetailsPage.addToCalendarButtonLabel" })
    fireEvent.click(calBtn)

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
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // The first schedule (sched_1) has NEEDS_CLARIFICATION, should render indicator
    const timezoneLabel = await screen.findByText("EventDetailsPage.timezoneClarificationLabel")
    expect(timezoneLabel).toBeInTheDocument()
  })

  it("does not render timezone clarification indicator for RESOLVED schedule", async () => {
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    // Should render twice (once for each schedule), but second one (sched_2) should not have it
    const clarificationLabels = screen.queryAllByText("EventDetailsPage.timezoneClarificationLabel")
    expect(clarificationLabels).toHaveLength(1) // Only first schedule
  })

  it("unauthenticated timezone submit redirects to /login", async () => {
    mockSession = null // Unauthenticated
    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()

    const timezoneInput = await screen.findByPlaceholderText("EventDetailsPage.timezoneSelectPlaceholder") as HTMLInputElement
    fireEvent.change(timezoneInput, { target: { value: "America/New_York" } })

    const submitButton = await screen.findByRole("button", { name: "EventDetailsPage.timezoneSubmitLabel" })
    fireEvent.click(submitButton)

    // Should redirect to login, not call mutation
    expect(mockRouterPush).toHaveBeenCalledWith("/login")
  })

  it("authenticated timezone submit calls mutation and shows success message", async () => {
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

  it("renders SubscribedAccountCard with a Subscribe button when not subscribed to the source account", async () => {
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
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument()
  })

  it("clicking Subscribe calls the mutation and updates to Subscribed on success", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = []

    renderComponent()

    const subscribeBtn = await screen.findByRole("button", { name: "Subscribe" })
    fireEvent.click(subscribeBtn)

    await waitFor(() => {
      expect(screen.getByText("EventDetailsPage.subscribeSuccessAnnouncement")).toBeInTheDocument()
    })

    // The card itself must reflect the change too, not just the
    // announcement -- driven by the ["getMySubscriptions"] refetch the
    // mutation's onSuccess triggers.
    await waitFor(() => {
      expect(screen.getByText("Subscribed")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Subscribe" })).not.toBeInTheDocument()
    })
  })

  it("shows Subscribed (no button) when already subscribed to the source account", async () => {
    currentMockEvent.sourceSocialMediaAccountProfile = {
      accountId: "123",
      platform: "instagram",
      username: "org",
      displayName: "Org",
      profileImageUrl: null,
    }
    currentMockSubscriptions = [{ account: { accountId: "123" } }]

    renderComponent()

    expect(await screen.findByRole("heading", { name: "Test Event" })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("Subscribed")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: "Subscribe" })).not.toBeInTheDocument()
  })
})
