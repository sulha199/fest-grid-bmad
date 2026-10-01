import { test, expect } from "@playwright/test"

// Story 0.38 (AC6/AC7, AD-21) — the event-detail route's response must carry a
// preconnect/dns-prefetch `Link` header for Instagram's fixed iframe origin,
// scoped to exactly this route. A deliberately separate spec file from
// `event-details-instagram-csp.spec.ts` (Story 3.7d/AC5's own regression
// guard, which must stay unmodified) even though both assert on the same
// route's response headers.
test.describe("Event Details - Instagram preconnect/dns-prefetch Link header (Story 0.38 AC6/AC7)", () => {
  test("the event-detail route's response carries the expected Link header", async ({ page }) => {
    const response = await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed")
    expect(response).not.toBeNull()

    const link = response!.headers()["link"]
    expect(link).toBe("<https://www.instagram.com>; rel=preconnect, <https://www.instagram.com>; rel=dns-prefetch")
  })

  test("an unrelated route does not carry the Link header", async ({ page }) => {
    const response = await page.goto("/en/discover")
    expect(response).not.toBeNull()

    const link = response!.headers()["link"]
    expect(link).toBeUndefined()
  })
})
