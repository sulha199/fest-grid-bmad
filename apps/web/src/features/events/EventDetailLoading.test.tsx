import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `EventDetailsPage.${key}`,
}))

import { EventDetailLoading } from "./EventDetailLoading"

describe("EventDetailLoading", () => {
  it("renders the event-detail skeleton with the localized loading label, not the RouteLoader logo", () => {
    const { container } = render(<EventDetailLoading />)
    const skeleton = screen.getByLabelText("EventDetailsPage.loadingText")
    expect(skeleton).toHaveAttribute("aria-busy", "true")
    expect(skeleton).toHaveClass("animate-pulse")
    expect(container.querySelector(".animate-heartbeat")).toBeNull()
  })
})
