import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import { EventPreviewCard } from "./event-preview-card"

describe("EventPreviewCard", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders the real image when imageUrl is provided", () => {
    render(<EventPreviewCard imageUrl="https://example.com/evt.jpg" imageAlt="Some Event" />)

    const img = screen.getByRole("img", { hidden: true }) as HTMLImageElement
    expect(img.src).toBe("https://example.com/evt.jpg")
    expect(img.alt).toBe("Some Event")
  })

  it("renders a placeholder block instead of an <img> when imageUrl is absent", () => {
    render(<EventPreviewCard imageUrl={null} imageAlt="Some Event" />)

    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
  })

  it("falls back to a placeholder block when the real image fails to load", () => {
    render(<EventPreviewCard imageUrl="https://example.com/broken.jpg" imageAlt="Some Event" />)

    const img = screen.getByRole("img", { hidden: true })
    fireEvent(img, new Event("error"))

    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
  })

  it("never renders real title/date text — only skeleton placeholders", () => {
    const { container } = render(<EventPreviewCard imageUrl="https://example.com/evt.jpg" imageAlt="Some Event" />)

    // Only the alt text (on the hidden <img>) should reference the event — no
    // visible text content anywhere else in the card.
    expect(container.textContent).toBe("")
  })

  it("is decorative — the whole card is aria-hidden", () => {
    const { container } = render(<EventPreviewCard imageUrl={null} imageAlt="Some Event" />)

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
  })
})
