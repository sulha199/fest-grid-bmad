import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { AiAssistedCorrectionTrigger, AiAssistedCorrectionTriggerLabels } from "./ai-assisted-correction-trigger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { graphql, HttpResponse } from "msw";
import { server as globalServer } from "../../../../../packages/testing-config/vitest.setup";
import { setupServer } from "msw/node";
import { ExtractionErrorCode } from "@/generated/graphql";

const mockLabels: AiAssistedCorrectionTriggerLabels = {
  triggerButtonLabel: "AI-Assisted Correction",
  urlInputLabel: "Social media post URL",
  urlInputPlaceholder: "Paste link here...",
  extractButtonLabel: "Extract",
  extractingAnnouncement: "Extracting...",
  errorNotFound: "Error: Not Found",
  errorUnsupportedPlatform: "Error: Unsupported Platform",
  errorNoApiKey: "Error: No API Key",
  errorScrapeFailed: "Error: Scrape Failed",
  errorExtractionFailed: "Error: Extraction Failed",
  errorQuotaExhausted: "Error: Quota Exhausted",
};

let mockMutationResponse: any = {
  extractEventDataFromUrl: {
    data: {
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
    },
    errorCode: null,
    errorMessage: null,
  },
};

const api = graphql.link("*/api/graphql");

const handlers = [
  api.mutation("extractEventDataFromUrl", ({ variables }) => {
    return HttpResponse.json({
      data: mockMutationResponse,
    });
  }),
];

const server = setupServer(...handlers);

describe("AiAssistedCorrectionTrigger", () => {
  let queryClient: QueryClient;
  const handleExtracted = vi.fn();

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
    handleExtracted.mockClear();
    mockMutationResponse = {
      extractEventDataFromUrl: {
        data: {
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
        },
        errorCode: null,
        errorMessage: null,
      },
    };
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AiAssistedCorrectionTrigger labels={mockLabels} onExtracted={handleExtracted} />
      </QueryClientProvider>
    );
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

  it("calls the mutation on Extract and invokes onExtracted on success", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: "AI-Assisted Correction" }));

    const input = screen.getByLabelText("Social media post URL");
    fireEvent.change(input, { target: { value: "https://instagram.com/p/123" } });

    const extractBtn = screen.getByRole("button", { name: "Extract" });
    fireEvent.click(extractBtn);

    await waitFor(() => {
      expect(handleExtracted).toHaveBeenCalledWith(
        mockMutationResponse.extractEventDataFromUrl.data
      );
    });
  });

  it("disables input and button and shows loader while pending", async () => {
    let resolveMutation: any;
    const promise = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });

    server.use(
      api.mutation("extractEventDataFromUrl", async () => {
        await promise;
        return HttpResponse.json({
          data: mockMutationResponse,
        });
      })
    );

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: "AI-Assisted Correction" }));

    const input = screen.getByLabelText("Social media post URL");
    fireEvent.change(input, { target: { value: "https://instagram.com/p/123" } });

    const extractBtn = screen.getByRole("button", { name: "Extract" });
    fireEvent.click(extractBtn);

    expect(input).toBeDisabled();
    expect(extractBtn).toBeDisabled();
    expect(screen.getByText("Extracting...")).toBeInTheDocument();

    resolveMutation();
    await waitFor(() => {
      expect(handleExtracted).toHaveBeenCalled();
    });
  });

  it("renders distinct inline error messages for each error code", async () => {
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
        extractEventDataFromUrl: {
          data: null,
          errorCode: code,
          errorMessage: "AI Error",
        },
      };

      renderComponent();
      fireEvent.click(screen.getByRole("button", { name: "AI-Assisted Correction" }));

      const input = screen.getByLabelText("Social media post URL");
      fireEvent.change(input, { target: { value: "https://instagram.com/p/123" } });

      const extractBtn = screen.getByRole("button", { name: "Extract" });
      fireEvent.click(extractBtn);

      expect(await screen.findByText(labelKey)).toBeInTheDocument();
      expect(handleExtracted).not.toHaveBeenCalled();
    }
  });
});
