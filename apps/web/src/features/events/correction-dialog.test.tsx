import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { CorrectionDialog } from "./correction-dialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { graphql, HttpResponse } from "msw";
import { server as globalServer } from "../../../../../packages/testing-config/vitest.setup";
import { setupServer } from "msw/node";

// Mock routers and posthog
const mockPosthogCapture = vi.fn();
vi.mock("@festgrid/analytics", () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock("next-intl", () => {
  const useTranslations = (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    t.rich = (key: string, values?: any) => {
      if (values && values.link) {
        return values.link(`${namespace}.${key}`);
      }
      return `${namespace}.${key}`;
    };
    return t;
  };
  return {
    useTranslations,
    useLocale: () => "en",
  };
});

const mockEvent = {
  id: "evt_1",
  eventName: "Test Event",
  description: "Event description text",
  location: "Main Stage Location",
  organizerName: "Fest Co",
  contactInfo: "contact@fest.co",
  types: ["FESTIVAL"] as any[],
  categories: ["MUSIC"] as any[],
  schedules: [
    {
      id: "sched_1",
      isMainSchedule: true,
      eventStartDate: "2026-08-10",
      eventEndDate: "2026-08-12",
      eventStartTime: "10:00",
      eventEndTime: "22:00",
      title: "Main Stage",
      performers: ["Artist A"],
      location: "Main Stage Location",
      ticketPrice: "$50",
    },
    {
      id: "sched_2",
      isMainSchedule: false,
      eventStartDate: "2026-08-11",
      title: "Side Stage",
    },
  ],
};

let mockResponseStatus = "applied";
let mockResponseErrors: any = null;

const api = graphql.link("*/api/graphql")

const handlers = [
  api.mutation("submitCorrection", ({ variables }) => {
    if (mockResponseStatus === "error") {
      return HttpResponse.json({ errors: [{ message: "Network Error" }] });
    }
    return HttpResponse.json({
      data: {
        submitCorrection: {
          id: "corr_123",
          status: mockResponseStatus,
          validationErrors: mockResponseErrors,
        },
      },
    });
  }),
];

const server = setupServer(...handlers);

describe("CorrectionDialog", () => {
  let queryClient: QueryClient;
  const handleClose = vi.fn();

  beforeAll(() => {
    globalServer.close();
    server.listen({ onUnhandledRequest: "bypass" });
  });

  afterAll(() => {
    server.close();
    globalServer.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockResponseStatus = "applied";
    mockResponseErrors = null;
    mockPosthogCapture.mockClear();
    handleClose.mockClear();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  const renderComponent = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CorrectionDialog isOpen={isOpen} onClose={handleClose} event={mockEvent as any} />
      </QueryClientProvider>
    );
  };

  it("pre-fills from initial values (organizerName/contactInfo/main-schedule-only)", async () => {
    renderComponent();

    // Wait for portal to mount
    expect(await screen.findByRole("heading", { name: "EventCorrectionForm.dialogTitle" })).toBeInTheDocument();

    expect(document.getElementById("eventName")).toHaveValue("Test Event");
    expect(document.getElementById("organizerName")).toHaveValue("Fest Co");
    expect(document.getElementById("contactInfo")).toHaveValue("contact@fest.co");
    expect(document.getElementById("description")).toHaveValue("Event description text");
    expect(document.getElementById("location")).toHaveValue("Main Stage Location");
    
    // Main schedule dates
    expect(document.getElementById("scheduleStartDate")).toHaveValue("2026-08-10");
    expect(document.getElementById("scheduleEndDate")).toHaveValue("2026-08-12");
    expect(document.getElementById("scheduleStartTime")).toHaveValue("10:00");
    expect(document.getElementById("scheduleEndTime")).toHaveValue("22:00");
    expect(document.getElementById("scheduleTitle")).toHaveValue("Main Stage");
    expect(document.getElementById("schedulePerformers")).toHaveValue("Artist A");
    expect(document.getElementById("scheduleTicketPrice")).toHaveValue("$50");

    // Side Stage is not main, so should NOT be in the form fields
    expect(screen.queryByDisplayValue("Side Stage")).not.toBeInTheDocument();
  });

  it("Zod failure blocks the mutation and shows inline errors", async () => {
    renderComponent();

    // Wait for portal to mount
    expect(await screen.findByRole("heading", { name: "EventCorrectionForm.dialogTitle" })).toBeInTheDocument();

    // Trigger validation error by clearing event name
    const eventNameInput = document.getElementById("eventName") as HTMLInputElement;
    fireEvent.change(eventNameInput, { target: { value: "" } });

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    // Should find the Zod error message
    expect(await screen.findByText("Event name is required")).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("Zod date-time consistency failure blocks mutation", async () => {
    renderComponent();

    // Wait for portal to mount
    expect(await screen.findByRole("heading", { name: "EventCorrectionForm.dialogTitle" })).toBeInTheDocument();

    // End date earlier than start date
    const endDateInput = document.getElementById("scheduleEndDate") as HTMLInputElement;
    fireEvent.change(endDateInput, { target: { value: "2026-08-09" } });

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    expect(await screen.findByText("Event end date must not be earlier than start date")).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("handles successful applied submission", async () => {
    renderComponent();

    // Wait for portal to mount
    expect(await screen.findByRole("heading", { name: "EventCorrectionForm.dialogTitle" })).toBeInTheDocument();

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_correction_submitted", {
        eventId: "evt_1",
        correctionId: "corr_123",
        source: "manual",
      });
    });
  });

  it("handles rejected submission with validationErrors", async () => {
    mockResponseStatus = "rejected";
    mockResponseErrors = [{ field: "eventName", message: "Rejected Event Name" }];

    renderComponent();

    // Wait for portal to mount
    expect(await screen.findByRole("heading", { name: "EventCorrectionForm.dialogTitle" })).toBeInTheDocument();

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    // Should stay open and show rejected error inline
    expect(await screen.findByText("Rejected Event Name")).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
    expect(mockPosthogCapture).not.toHaveBeenCalled();
  });

  it("handles successful AI extraction, overwrites fields except main schedule id, and submits with source: 'ai_assisted'", async () => {
    const mockExtractionData = {
      extractEventDataFromUrl: {
        data: {
          eventName: "Extracted Event Name",
          types: ["CONCERT"],
          categories: ["MUSIC"],
          location: "Extracted Location",
          organizerName: "Extracted Org",
          contactInfo: "extracted@org.com",
          description: "Extracted Desc",
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: "2026-11-20",
              eventEndDate: "2026-11-22",
              eventStartTime: "12:00",
              eventEndTime: "21:00",
              title: "Extracted Stage",
              performers: ["Extracted Artist"],
              location: "Extracted Sched Loc",
              ticketPrice: "$99",
            },
          ],
        },
        errorCode: null,
        errorMessage: null,
      },
    };

    server.use(
      api.mutation("extractEventDataFromUrl", () => {
        return HttpResponse.json({
          data: mockExtractionData,
        });
      })
    );

    renderComponent();

    // Find trigger button and click it
    const triggerBtn = await screen.findByRole("button", { name: "AiAssistedCorrection.triggerButtonLabel" });
    fireEvent.click(triggerBtn);

    // Paste URL and extract
    const input = await screen.findByLabelText("AiAssistedCorrection.urlInputLabel");
    fireEvent.change(input, { target: { value: "https://instagram.com/p/123" } });

    const extractBtn = screen.getByRole("button", { name: "AiAssistedCorrection.extractButtonLabel" });
    fireEvent.click(extractBtn);

    // Wait for form fields to be updated
    await waitFor(() => {
      expect(document.getElementById("eventName")).toHaveValue("Extracted Event Name");
      expect(document.getElementById("location")).toHaveValue("Extracted Location");
    });

    // Now submit the form
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_correction_ai_extraction_succeeded", {
        eventId: "evt_1",
      });
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_correction_submitted", {
        eventId: "evt_1",
        correctionId: "corr_123",
        source: "ai_assisted",
      });
    });
  });
});
