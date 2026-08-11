import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { ReportDialog } from "./report-dialog";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { graphql, HttpResponse } from "msw";
import { server as globalServer } from "../../../../../packages/testing-config/vitest.setup";
import { setupServer } from "msw/node";

// Mock posthog and toast
const mockPosthogCapture = vi.fn();
vi.mock("@festgrid/analytics", () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

vi.mock("next-intl", () => {
  const useTranslations = (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    return t;
  };
  return {
    useTranslations,
  };
});

let mockResponseCode: string | null = null;
let shouldFailGeneric = false;

const api = graphql.link("*/api/graphql");

const handlers = [
  api.mutation("submitReport", ({ variables }) => {
    if (shouldFailGeneric) {
      return HttpResponse.json({ errors: [{ message: "Network Error" }] });
    }
    if (mockResponseCode === "REPORT_IGNORED") {
      return HttpResponse.json({
        errors: [
          {
            message: "Report ignored",
            extensions: { code: "REPORT_IGNORED" },
          },
        ],
      });
    }
    return HttpResponse.json({
      data: {
        submitReport: {
          id: "rep_123",
          reason: variables.reason,
          status: "pending",
          createdAt: "2026-08-11T12:00:00Z",
        },
      },
    });
  }),
];

const server = setupServer(...handlers);

describe("ReportDialog", () => {
  let queryClient: QueryClient;
  const handleClose = vi.fn();
  const handleReported = vi.fn();

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
    mockResponseCode = null;
    shouldFailGeneric = false;
    mockPosthogCapture.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    handleClose.mockClear();
    handleReported.mockClear();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
  });

  const renderComponent = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ReportDialog
          isOpen={isOpen}
          onClose={handleClose}
          eventId="evt_1"
          onReported={handleReported}
        />
      </QueryClientProvider>
    );
  };

  it("submit button stays disabled until a reason is chosen", async () => {
    renderComponent();

    const submitBtn = screen.getByRole("button", { name: "EventReportForm.submitButtonLabel" });
    expect(submitBtn).toBeDisabled();

    // Select 'Personal' reason
    const personalRadio = document.getElementById("reason-personal") as HTMLButtonElement;
    expect(personalRadio).toBeInTheDocument();
    fireEvent.click(personalRadio);

    // Should now be enabled
    expect(submitBtn).not.toBeDisabled();
  });

  it("handles successful report submission and triggers success flow", async () => {
    renderComponent();

    // Select reason
    const personalRadio = document.getElementById("reason-personal") as HTMLButtonElement;
    fireEvent.click(personalRadio);

    // Optional details
    const detailsTextarea = document.getElementById("details") as HTMLTextAreaElement;
    fireEvent.change(detailsTextarea, { target: { value: "Some personal reason details" } });

    // Submit
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(handleReported).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith("EventReportForm.successToast");
      expect(mockPosthogCapture).toHaveBeenCalledWith("event_reported", {
        eventId: "evt_1",
        reportId: "rep_123",
        reason: "personal",
      });
    });
  });

  it("handles REPORT_IGNORED error gracefully", async () => {
    mockResponseCode = "REPORT_IGNORED";
    renderComponent();

    // Select reason
    const dangerousRadio = document.getElementById("reason-dangerous") as HTMLButtonElement;
    fireEvent.click(dangerousRadio);

    // Submit
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(handleReported).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("EventReportForm.reportIgnoredError");
      expect(mockPosthogCapture).not.toHaveBeenCalled();
    });
  });

  it("handles generic/network errors", async () => {
    shouldFailGeneric = true;
    renderComponent();

    // Select reason
    const cancelledRadio = document.getElementById("reason-cancelled") as HTMLButtonElement;
    fireEvent.click(cancelledRadio);

    // Submit
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("EventReportForm.errorToast");
      // Dialog should stay open and onReported should NOT be called
      expect(handleClose).not.toHaveBeenCalled();
      expect(handleReported).not.toHaveBeenCalled();
      expect(mockPosthogCapture).not.toHaveBeenCalled();
    });
  });
});
