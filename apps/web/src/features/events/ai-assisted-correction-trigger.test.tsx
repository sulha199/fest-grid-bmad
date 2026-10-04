import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { AiAssistedCorrectionTrigger, AiAssistedCorrectionTriggerLabels } from "./ai-assisted-correction-trigger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { graphql, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ExtractionErrorCode } from "@/generated/graphql";

const mockLabels: AiAssistedCorrectionTriggerLabels = {
  triggerButtonLabel: "AI-Assisted Correction",
  urlInputLabel: "Social media post URL",
  urlInputPlaceholder: "Paste link here...",
  extractButtonLabel: "Extract",
  extractingAnnouncement: "Extracting...",
  stillProcessing: "Still working...",
  errorNotFound: "Error: Not Found",
  errorUnsupportedPlatform: "Error: Unsupported Platform",
  errorNoApiKey: "Error: No API Key",
  errorScrapeFailed: "Error: Scrape Failed",
  errorExtractionFailed: "Error: Extraction Failed",
  errorQuotaExhausted: "Error: Quota Exhausted",
};

const EXTRACTED_DATA = {
  eventName: "Extracted Event",
  types: ["FESTIVAL"],
  categories: ["MUSIC"],
  location: "Extracted Location",
  organizerName: "Extracted Organizer",
  contactInfo: "extracted@contact.com",
  description: "Extracted Description",
  schedules: [
    {
      isMainSchedule: true,
      eventStartDate: "2026-09-10",
      eventEndDate: "2026-09-12",
      eventStartTime: "14:00",
      eventEndTime: "23:00",
      title: "Main Stage",
      performers: ["Performer B"],
      location: "Extracted Schedule Location",
      ticketPrice: "$75",
    },
  ],
};

// Story 4.2b -- the mutation only STARTS a job (or returns a pre-check error); the extraction is
// then polled via the extractionJob query. Both are driven here by two mutable mocks.
let mockMutationResponse: any;
let mockJobResponses: any[]; // consumed in order; the last one repeats
let jobQueryCalls = 0;

const api = graphql.link("*/api/graphql");

const handlers = [
  api.mutation("extractEventDataFromUrl", () => {
    return HttpResponse.json({ data: mockMutationResponse });
  }),
  api.query("extractionJob", () => {
    const idx = Math.min(jobQueryCalls, mockJobResponses.length - 1);
    jobQueryCalls++;
    return HttpResponse.json({ data: { extractionJob: mockJobResponses[idx] } });
  }),
];

const server = setupServer(...handlers);

const started = { jobId: "job-1", data: null, errorCode: null, errorMessage: null };
const succeeded = { status: "SUCCEEDED", data: EXTRACTED_DATA, errorCode: null, errorMessage: null };
const pending = { status: "PENDING", data: null, errorCode: null, errorMessage: null };
const processing = { status: "PROCESSING", data: null, errorCode: null, errorMessage: null };

describe("AiAssistedCorrectionTrigger", () => {
  let queryClient: QueryClient;
  const handleExtracted = vi.fn();

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "bypass" });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    handleExtracted.mockClear();
    jobQueryCalls = 0;
    mockMutationResponse = { extractEventDataFromUrl: started };
    mockJobResponses = [succeeded];
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AiAssistedCorrectionTrigger labels={mockLabels} onExtracted={handleExtracted} />
      </QueryClientProvider>
    );
  };

  const openAndSubmit = () => {
    fireEvent.click(screen.getByRole("button", { name: "AI-Assisted Correction" }));
    const input = screen.getByLabelText("Social media post URL");
    fireEvent.change(input, { target: { value: "https://instagram.com/p/123" } });
    const extractBtn = screen.getByRole("button", { name: "Extract" });
    fireEvent.click(extractBtn);
    return { input, extractBtn };
  };

  it("initially shows trigger button and reveals input on click", async () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "AI-Assisted Correction" });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.queryByLabelText("Social media post URL")).not.toBeInTheDocument();

    fireEvent.click(triggerBtn);

    expect(await screen.findByLabelText("Social media post URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste link here...")).toBeInTheDocument();
  });

  it("starts a job on Extract, polls it, and invokes onExtracted when it SUCCEEDS", async () => {
    renderComponent();
    openAndSubmit();

    await waitFor(() => {
      expect(handleExtracted).toHaveBeenCalledWith(EXTRACTED_DATA);
    });
    expect(handleExtracted).toHaveBeenCalledTimes(1);
  });

  it("keeps polling through PENDING/PROCESSING and only then calls onExtracted", async () => {
    mockJobResponses = [pending, processing, succeeded];
    renderComponent();
    openAndSubmit();

    await waitFor(() => expect(jobQueryCalls).toBeGreaterThanOrEqual(1));
    expect(handleExtracted).not.toHaveBeenCalled();

    await waitFor(() => expect(handleExtracted).toHaveBeenCalledWith(EXTRACTED_DATA), { timeout: 8000 });
    expect(jobQueryCalls).toBe(3);
  }, 12000);

  it("disables input and button and shows the localized loader while starting and while the job is in flight", async () => {
    mockJobResponses = [pending];
    renderComponent();
    const { input, extractBtn } = openAndSubmit();

    expect(input).toBeDisabled();
    expect(extractBtn).toBeDisabled();
    expect(screen.getByText("Extracting...")).toBeInTheDocument();

    // Still disabled after the mutation resolved, because the job is now polling.
    await waitFor(() => expect(jobQueryCalls).toBeGreaterThanOrEqual(1));
    expect(input).toBeDisabled();
    expect(extractBtn).toBeDisabled();
    expect(handleExtracted).not.toHaveBeenCalled();
  });

  it("switches to the 'still processing' label after 15 s without a terminal status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockJobResponses = [pending];
    renderComponent();
    openAndSubmit();

    await waitFor(() => expect(jobQueryCalls).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("Extracting...")).toBeInTheDocument();
    expect(screen.queryByText("Still working...")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15500);
    });

    expect(await screen.findByText("Still working...")).toBeInTheDocument();
    expect(handleExtracted).not.toHaveBeenCalled();
  });

  it("renders distinct inline error messages for each pre-check error code returned by the mutation", async () => {
    const errorCodes: { code: ExtractionErrorCode; labelKey: string }[] = [
      { code: ExtractionErrorCode.NotFound, labelKey: "Error: Not Found" },
      { code: ExtractionErrorCode.UnsupportedPlatform, labelKey: "Error: Unsupported Platform" },
      { code: ExtractionErrorCode.NoApiKey, labelKey: "Error: No API Key" },
      { code: ExtractionErrorCode.ScrapeFailed, labelKey: "Error: Scrape Failed" },
      { code: ExtractionErrorCode.ExtractionFailed, labelKey: "Error: Extraction Failed" },
      { code: ExtractionErrorCode.QuotaExhausted, labelKey: "Error: Quota Exhausted" },
    ];

    for (const { code, labelKey } of errorCodes) {
      cleanup();
      mockMutationResponse = {
        extractEventDataFromUrl: { jobId: null, data: null, errorCode: code, errorMessage: "AI Error" },
      };

      renderComponent();
      openAndSubmit();

      expect(await screen.findByText(labelKey)).toBeInTheDocument();
      expect(handleExtracted).not.toHaveBeenCalled();
      expect(jobQueryCalls).toBe(0); // no job was started, so nothing is polled
    }
  });

  it("renders the matching inline error when a polled job FAILED, for each errorCode", async () => {
    const cases: { code: ExtractionErrorCode; labelKey: string }[] = [
      { code: ExtractionErrorCode.QuotaExhausted, labelKey: "Error: Quota Exhausted" },
      { code: ExtractionErrorCode.ExtractionFailed, labelKey: "Error: Extraction Failed" },
    ];
    for (const { code, labelKey } of cases) {
      cleanup();
      queryClient.clear(); // the job id is the same each iteration; don't serve the previous one from cache
      jobQueryCalls = 0;
      mockJobResponses = [{ status: "FAILED", data: null, errorCode: code, errorMessage: "x" }];
      renderComponent();
      const { input } = openAndSubmit();

      expect(await screen.findByText(labelKey)).toBeInTheDocument();
      expect(handleExtracted).not.toHaveBeenCalled();
      // The panel is usable again after a failed job.
      await waitFor(() => expect(input).not.toBeDisabled());
    }
  });

  it("falls back to EXTRACTION_FAILED when the job SUCCEEDED but carries no data", async () => {
    mockJobResponses = [{ status: "SUCCEEDED", data: null, errorCode: null, errorMessage: null }];
    renderComponent();
    openAndSubmit();

    expect(await screen.findByText("Error: Extraction Failed")).toBeInTheDocument();
    expect(handleExtracted).not.toHaveBeenCalled();
  });

  it("shows EXTRACTION_FAILED and stops polling when the poll request itself errors", async () => {
    server.use(
      api.query("extractionJob", () => {
        jobQueryCalls++;
        return HttpResponse.json({ errors: [{ message: "boom" }] }, { status: 500 });
      })
    );
    renderComponent();
    const { input } = openAndSubmit();

    // The hook retries the poll twice (1 s + 2 s backoff) before giving up.
    expect(await screen.findByText("Error: Extraction Failed", {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(jobQueryCalls).toBe(3);
    server.resetHandlers();
  }, 12000);

  it("stops polling when the component unmounts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockJobResponses = [pending];
    const { unmount } = renderComponent();
    openAndSubmit();

    await waitFor(() => expect(jobQueryCalls).toBeGreaterThanOrEqual(1));
    unmount();
    const callsAtUnmount = jobQueryCalls;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(jobQueryCalls).toBe(callsAtUnmount);
    expect(handleExtracted).not.toHaveBeenCalled();
  });
});
