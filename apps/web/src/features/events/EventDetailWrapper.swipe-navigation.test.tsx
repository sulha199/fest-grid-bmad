import React from "react"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventDetailWrapper } from "./EventDetailWrapper"

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as any

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver as any

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { graphql, HttpResponse } from "msw"
import { server as globalServer } from "../../../../../packages/testing-config/vitest.setup"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"

const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

let mockSearchParams = new URLSearchParams("fromList=favorites&favoriteIds=evt_1,evt_2,evt_3")
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

vi.mock("@festgrid/analytics", () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

vi.mock("@/components/providers/auth-session-provider", () => ({
  useAuthSession: () => ({ session: { user: { id: "u_1" } } }),
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => "en",
}))

// A minimal fake Embla instance: real drag/pointer physics don't work reliably
// under jsdom (no real layout), so this simulates "Embla has committed to a new
// snap index" the same way a completed swipe would — by directly moving the
// index and firing the same "select" event real Embla fires on commit. This
// exercises the actual onSelect closure EventDetailWrapper registers, just
// without needing a real drag gesture to produce it.
const { fakeEmblaApi } = vi.hoisted(() => {
  const listeners: Record<string, Array<() => void>> = {}
  let selected = 0
  const api = {
    on: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(cb)
    },
    off: (event: string, cb: () => void) => {
      listeners[event] = (listeners[event] || []).filter((l) => l !== cb)
    },
    selectedScrollSnap: () => selected,
    scrollTo: (index: number) => {
      if (index === selected) return
      selected = index
      ;(listeners["select"] || []).forEach((cb) => cb())
    },
    scrollPrev: () => api.scrollTo(selected - 1),
    scrollNext: () => api.scrollTo(selected + 1),
    canScrollPrev: () => selected > 0,
    canScrollNext: () => true,
    reInit: () => {},
  }
  return { fakeEmblaApi: api }
})

vi.mock("embla-carousel-react", () => ({
  default: () => [() => {}, fakeEmblaApi],
}))

const currentMockEvent = {
  id: "evt_2",
  eventName: "Second Event",
  slug: "second-event",
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

const api = graphql.link("*/api/graphql")

const handlers = [
  api.query("getEventBySlug", () => {
    return HttpResponse.json({ data: { eventBySlug: { ...currentMockEvent } } })
  }),
  api.query("getEvents", ({ variables }) => {
    const idCondition = (variables as any)?.query?.conditions?.find((c: any) => c?.field === "id")
    const ids = (idCondition?.value ?? []) as string[]
    const eventNames: Record<string, string> = { evt_1: "First Event", evt_2: "Second Event", evt_3: "Third Event" }
    const slugs: Record<string, string> = { evt_1: "first-event", evt_2: "second-event", evt_3: "third-event" }

    const rows = ids.map((id) => ({
      id,
      eventName: eventNames[id] ?? "Event",
      slug: slugs[id] ?? "event",
      isFavorited: true,
      imageUrl: null,
      location: "Test Location",
      types: [],
      categories: [],
      schedules: [
        { id: `${id}-schedule`, isMainSchedule: true, eventStartDate: new Date().toISOString(), ticketPrice: null },
      ],
    }))

    return HttpResponse.json({
      data: { events: { items: rows, hasMore: false, totalCount: rows.length } },
    })
  }),
]

describe("EventDetailWrapper — swipe-gesture navigation", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    globalServer.use(...handlers)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockSearchParams = new URLSearchParams("fromList=favorites&favoriteIds=evt_1,evt_2,evt_3")
    mockRouterReplace.mockClear()
    mockRouterPush.mockClear()
    fakeEmblaApi.scrollTo(1) // reset back to the "current" slide index used by these tests
  })

  afterEach(() => {
    // Proper RTL unmount (not just wiping the DOM) so EventDetailWrapper's
    // useEffect cleanup runs and deregisters its "select" listener from
    // fakeEmblaApi — otherwise stale listeners from prior tests would pile up
    // on the module-level fake instance and fire alongside the current test's.
    cleanup()
    queryClient.clear()
  })

  const renderComponent = () => {
    return render(
      <NuqsTestingAdapter>
        <QueryClientProvider client={queryClient}>
          <EventDetailWrapper slug="second-event" />
        </QueryClientProvider>
      </NuqsTestingAdapter>
    )
  }

  it("navigates to the next event when Embla commits to the next slide index", async () => {
    renderComponent()
    expect(await screen.findByRole("heading", { name: "Second Event" })).toBeInTheDocument()

    // Simulate a completed swipe-right: Embla commits to the slide after current.
    fakeEmblaApi.scrollTo(2)

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        "/events/third-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2%2Cevt_3"
      )
    })
  })

  it("navigates to the previous event when Embla commits to the previous slide index", async () => {
    renderComponent()
    expect(await screen.findByRole("heading", { name: "Second Event" })).toBeInTheDocument()

    // Simulate a completed swipe-left: Embla commits to the slide before current.
    fakeEmblaApi.scrollTo(0)

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        "/events/first-event?fromList=favorites&favoriteIds=evt_1%2Cevt_2%2Cevt_3"
      )
    })
  })

  it("does not navigate when Embla re-settles on the already-current index", async () => {
    renderComponent()
    expect(await screen.findByRole("heading", { name: "Second Event" })).toBeInTheDocument()

    fakeEmblaApi.scrollTo(1) // no-op: already current

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled()
    })
  })
})
