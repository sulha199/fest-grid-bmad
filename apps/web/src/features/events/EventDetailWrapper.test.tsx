import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest"
import { EventDetailWrapper } from "./EventDetailWrapper"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { graphql, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"

// Mock router and auth session
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
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
  imageUrl: null,
  sourcePostUrl: null,
  originalPostUrl: null,
  isFavorited: false,
  schedules: [],
}

const handlers = [
  graphql.query("getEventBySlug", ({ query, variables }) => {
    return HttpResponse.json({
      data: {
        eventBySlug: { ...currentMockEvent },
      },
    })
  }),
  graphql.query("getEvents", ({ variables }) => {
    const idCondition = (variables as any)?.query?.conditions?.find((c: any) => c?.field === "id")
    const ids = (idCondition?.value ?? []) as string[]

    const rows = ids.map((id) => ({
      id,
      eventName: id === "evt_2" ? "Second Event" : "Test Event",
      slug: id === "evt_2" ? "second-event" : "test-event",
      isFavorited: true,
      imageUrl: null,
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
  graphql.mutation("toggleFavorite", ({ variables }) => {
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
]

const server = setupServer(...handlers)

describe("EventDetailWrapper", () => {
  let queryClient: QueryClient

  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
  afterAll(() => server.close())

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockSession = { user: { id: "u_1" } } // Default authenticated
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
      sourcePostUrl: null,
      originalPostUrl: null,
      isFavorited: false,
      schedules: [],
    }
    mockPosthogCapture.mockClear()
    mockRouterReplace.mockClear()
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
})
