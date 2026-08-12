import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { graphql, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { server as globalServer } from "../../../../../../packages/testing-config/vitest.setup";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import enMessages from "../../../../locales/en.json";
import { ReportsContent } from "./reports-content";

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@festgrid/analytics", () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

let mockSession: any = { user: { id: "user-1", email: "user@test.dev" } };
let mockAuthLoading = false;
vi.mock("@/components/providers/auth-session-provider", () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

const MOCK_REPORTS = [
  {
    id: "rep-1",
    reason: "PERSONAL",
    status: "PENDING",
    createdAt: "2026-08-10T12:00:00Z",
    event: {
      id: "evt-1",
      slug: "event-one",
      eventName: "Awesome Festival One",
      imageUrl: "https://test.dev/image1.jpg",
    },
  },
  {
    id: "rep-2",
    reason: "CANCELLED",
    status: "UPHELD",
    createdAt: "2026-08-11T12:00:00Z",
    event: {
      id: "evt-2",
      slug: "event-two",
      eventName: "Cancelled Gig Two",
      imageUrl: null,
    },
  },
  {
    id: "rep-3",
    reason: "DANGEROUS",
    status: "DISMISSED",
    createdAt: "2026-08-12T12:00:00Z",
    event: {
      id: "evt-3",
      slug: "event-three",
      eventName: "Rave Three",
      imageUrl: "https://test.dev/image3.jpg",
    },
  },
];

const api = graphql.link("*/api/graphql");

let reportsResponseHandler = () => HttpResponse.json({
  data: {
    myReports: MOCK_REPORTS,
  },
});

const server = setupServer(
  api.query("myReports", () => {
    return reportsResponseHandler();
  })
);

describe("ReportsContent Integration", () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    globalServer.close();
    server.listen({ onUnhandledRequest: "bypass" });
  });

  afterEach(() => {
    server.resetHandlers();
    cleanup();
    vi.clearAllMocks();
    reportsResponseHandler = () => HttpResponse.json({
      data: {
        myReports: MOCK_REPORTS,
      },
    });
  });

  afterAll(() => {
    server.close();
    globalServer.listen({ onUnhandledRequest: "error" });
  });

  const renderWithProviders = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <QueryClientProvider client={queryClient}>
          <ReportsContent />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  };

  it("redirects unauthenticated users to /login and does not fetch data", async () => {
    mockSession = null;
    renderWithProviders();

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/login");
    });
  });

  it("displays reports with their event names, reasons, statuses and dates", async () => {
    mockSession = { user: { id: "user-1", email: "user@test.dev" } };
    renderWithProviders();

    // Verify page title
    expect(screen.getByRole("heading", { name: "My Reports" })).toBeInTheDocument();

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText("Awesome Festival One")).toBeInTheDocument();
    });

    expect(screen.getByText("Cancelled Gig Two")).toBeInTheDocument();
    expect(screen.getByText("Rave Three")).toBeInTheDocument();

    // Verify reasons (localized)
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Dangerous")).toBeInTheDocument();

    // Verify statuses (localized StatusBadge labels)
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Upheld")).toBeInTheDocument();
    expect(screen.getByText("Dismissed")).toBeInTheDocument();

    // Verify page view analytics fired
    expect(mockPosthogCapture).toHaveBeenCalledWith("reports_page_viewed", {
      reportCount: 3,
    });
  });

  it("displays empty state when there are no reports", async () => {
    mockSession = { user: { id: "user-1", email: "user@test.dev" } };
    reportsResponseHandler = () => HttpResponse.json({
      data: {
        myReports: [],
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("You have not submitted any reports yet.")).toBeInTheDocument();
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith("reports_page_viewed", {
      reportCount: 0,
    });
  });

  it("displays error state when the query fails", async () => {
    mockSession = { user: { id: "user-1", email: "user@test.dev" } };
    reportsResponseHandler = () => HttpResponse.json({
      errors: [{ message: "Database failure" }],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Failed to load submitted reports. Please try again later.")).toBeInTheDocument();
    });

    expect(screen.getByText("Database failure", { exact: false })).toBeInTheDocument();
  });
});
