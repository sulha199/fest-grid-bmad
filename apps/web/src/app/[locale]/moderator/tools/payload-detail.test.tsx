import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { PayloadDetail } from "./payload-detail"
import type { UnprocessedScraperPayload } from "./types"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      validationErrorLabel: "Validation Error",
      rawJsonLabel: "Raw JSON",
      parserVersionLabel: "Parser Version",
      reprocessButton: "Reprocess",
      reprocessingLabel: "Reprocessing...",
    }
    return translations[key] || key
  },
}))

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

describe("PayloadDetail", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders rawPayload when the server sends it as an already-parsed object (JSON scalar)", () => {
    render(
      <PayloadDetail
        payload={buildPayload({ caption: "hello world", nested: { a: 1 } })}
        onReprocess={vi.fn()}
        isReprocessing={false}
      />
    )

    expect(screen.getByText(/"caption": "hello world"/)).toBeInTheDocument()
  })

  it("still renders rawPayload when it is a JSON-encoded string", () => {
    render(
      <PayloadDetail
        payload={buildPayload(JSON.stringify({ caption: "legacy string payload" }))}
        onReprocess={vi.fn()}
        isReprocessing={false}
      />
    )

    expect(screen.getByText(/"caption": "legacy string payload"/)).toBeInTheDocument()
  })

  it("falls back to the raw string when it is not valid JSON", () => {
    render(<PayloadDetail payload={buildPayload("not json")} onReprocess={vi.fn()} isReprocessing={false} />)

    expect(screen.getByText("not json")).toBeInTheDocument()
  })
})
