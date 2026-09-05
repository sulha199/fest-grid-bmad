import type { ReactElement } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PayloadDetail } from "./payload-detail"
import { useParserVersionsQuery } from "./unprocessed-payloads-hooks"
import type { UnprocessedScraperPayload } from "./types"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      validationErrorLabel: "Validation Error",
      rawJsonLabel: "Raw JSON",
      parserVersionLabel: "Parser Version",
      reprocessButton: "Reprocess",
      reprocessingLabel: "Reprocessing...",
      loadingLabel: "Loading payloads...",
      currentVersionBadge: "(current)",
      noParserVersionsMessage: "No registered parser versions for this payload's source.",
    }
    return translations[key] || key
  },
}))

vi.mock("./unprocessed-payloads-hooks")

const mockedUseParserVersionsQuery = vi.mocked(useParserVersionsQuery)

function buildPayload(rawPayload: unknown): UnprocessedScraperPayload {
  return {
    id: "payload-1",
    rawPayload,
    validationError: [{ message: "Something went wrong" }],
    context: {
      source: "APIFY",
      scraperVendor: null,
      accountId: null,
      postUrl: null,
      timestamp: new Date().toISOString(),
      parserVersion: "1.0.0",
    },
    createdAt: new Date().toISOString(),
    deletedAt: null,
  }
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("PayloadDetail", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders rawPayload when the server sends it as an already-parsed object (JSON scalar)", () => {
    mockedUseParserVersionsQuery.mockReturnValue({ data: [], isLoading: false } as any)

    renderWithClient(
      <PayloadDetail
        payload={buildPayload({ caption: "hello world", nested: { a: 1 } })}
        onReprocess={vi.fn()}
        isReprocessing={false}
      />
    )

    expect(screen.getByText(/"caption": "hello world"/)).toBeInTheDocument()
  })

  it("still renders rawPayload when it is a JSON-encoded string", () => {
    mockedUseParserVersionsQuery.mockReturnValue({ data: [], isLoading: false } as any)

    renderWithClient(
      <PayloadDetail
        payload={buildPayload(JSON.stringify({ caption: "legacy string payload" }))}
        onReprocess={vi.fn()}
        isReprocessing={false}
      />
    )

    expect(screen.getByText(/"caption": "legacy string payload"/)).toBeInTheDocument()
  })

  it("falls back to the raw string when it is not valid JSON", () => {
    mockedUseParserVersionsQuery.mockReturnValue({ data: [], isLoading: false } as any)

    renderWithClient(<PayloadDetail payload={buildPayload("not json")} onReprocess={vi.fn()} isReprocessing={false} />)

    expect(screen.getByText("not json")).toBeInTheDocument()
  })

  it("shows the registered parser versions for the payload's source as dropdown options", () => {
    mockedUseParserVersionsQuery.mockReturnValue({
      data: [
        { id: "v1", version: "3.4m", description: "Apify actor-selection field mapping", source: "APIFY", isActive: true },
      ],
      isLoading: false,
    } as any)

    renderWithClient(<PayloadDetail payload={buildPayload({})} onReprocess={vi.fn()} isReprocessing={false} />)

    expect(screen.getByRole("option", { name: /3\.4m/ })).toBeInTheDocument()
  })

  it("shows a message and disables reprocessing when no parser versions are registered for the payload's source", () => {
    mockedUseParserVersionsQuery.mockReturnValue({ data: [], isLoading: false } as any)

    renderWithClient(<PayloadDetail payload={buildPayload({})} onReprocess={vi.fn()} isReprocessing={false} />)

    expect(screen.getByText("No registered parser versions for this payload's source.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reprocess" })).toBeDisabled()
  })
})
