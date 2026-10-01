import { test, expect } from "@playwright/test"

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE
if (storageStatePath) {
  test.use({ storageState: storageStatePath })
}

test.describe("Event Details", () => {
  test("should open modal when clicking an event card, update the URL, and support close", async ({ page }) => {
    // Navigate to the main discovery page
    await page.goto("/en")

    // Find and click the first event card
    const firstCard = page.locator("article").first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })

    const eventName = await firstCard.locator("h3").innerText()

    // Click on the primary clickable area of the card
    await firstCard.click()

    // Verify modal is open and URL is updated
    await expect(page).toHaveURL(/\/en\/events\/[a-z0-9-]+/)

    // Check modal title matches clicked card's name
    const modalTitle = page.locator("role=dialog").locator("h1")
    await expect(modalTitle).toHaveText(eventName)

    // Verify close modal button dismisses the modal and restores URL
    const closeBtn = page.getByRole("button", { name: "Close modal" })
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()

    // URL should go back to home page
    await expect(page).toHaveURL(/\/en$/)
    await expect(page.locator("role=dialog")).not.toBeVisible()
  })

  test("should redirect unauthenticated users to login on favorite click", async ({ page }) => {
    // Clear any previous session
    await page.addInitScript(() => {
      localStorage.removeItem("sb-shvehlxrbeifvqnspowi-auth-token")
      localStorage.removeItem("festgrid_has_session")
    })

    // Navigate to a specific event
    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed")

    // Wait for heading to load
    await expect(page.locator("h1", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible()

    // Find the favorite button (it should be in "Add to Favorites" state initially)
    const favBtn = page.getByRole("button", { name: "Add to Favorites" })
    await expect(favBtn).toHaveAttribute("aria-pressed", "false")

    // Click to favorite
    await favBtn.click()

    // Verify it redirects to login
    await expect(page).toHaveURL(/\/en\/login/)
  })

  test("should support deep-link direct navigation to event detail view", async ({ page }) => {
    // Navigate directly to the deep link for ongoing culture fest
    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed")

    // Standalone detail view should render the title
    const eventHeading = page.locator("h1")
    await expect(eventHeading).toHaveText("Ongoing Culture Fest 2026-2027")

    // Since accessed directly via deep link with no list context, the navigation controls must be hidden/disabled
    const prevBtn = page.getByRole("button", { name: "Previous Event" })
    const nextBtn = page.getByRole("button", { name: "Next Event" })
    await expect(prevBtn).not.toBeVisible()
    await expect(nextBtn).not.toBeVisible()
  })

  // Story 1.6c (AC4) — proves the observable, client-side half of "not two fetches": after the
  // SSR-hydrated page settles, the browser must issue ZERO additional client-initiated
  // /api/graphql requests for the getEventBySlug operation (the server-side dedup, AC2(a), runs
  // inside the Next.js server process and is not independently observable via browser-level
  // network interception -- verified separately per Task 9's manual check).
  function countGetEventBySlugRequests(page: import("@playwright/test").Page): { count: () => number } {
    let count = 0
    page.on("request", (request) => {
      if (!request.url().includes("/api/graphql")) return
      const postData = request.postData()
      if (postData && postData.includes("getEventBySlug")) {
        count++
      }
    })
    return { count: () => count }
  }

  test("issues zero client-initiated getEventBySlug requests after the full-page route settles (Story 1.6c AC4)", async ({ page }) => {
    const tracker = countGetEventBySlugRequests(page)

    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed")
    await expect(page.locator("h1", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible()

    // Settle window: give any would-be client re-fetch a chance to fire before asserting it didn't.
    await page.waitForTimeout(1000)

    expect(tracker.count()).toBe(0)
  })

  test("issues zero client-initiated getEventBySlug requests after the intercepted modal route settles (Story 1.6c AC4)", async ({ page }) => {
    await page.goto("/en")
    const firstCard = page.locator("article").first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })

    // Start tracking only once the modal navigation begins, so the initial Discovery-page
    // load's own network activity (unrelated to this route pair) isn't counted.
    const tracker = countGetEventBySlugRequests(page)

    await firstCard.click()
    await expect(page).toHaveURL(/\/en\/events\/[a-z0-9-]+/)
    await expect(page.locator("role=dialog").locator("h1")).toBeVisible()

    await page.waitForTimeout(1000)

    expect(tracker.count()).toBe(0)
  })

  // Story 1.6c (AC7) — proves the SSR-hydrated fetch is AUTHENTICATED, not just deduped: a
  // logged-in visitor who has already favorited an event sees the "favorited" state on first
  // paint, not a forced `false` momentarily corrected by a background refetch (the concrete
  // risk this story's Design Decision Dev Note escalated). Requires a real seeded, logged-in
  // session with at least one favorited event -- gated on the same E2E_AUTH_STORAGE_STATE
  // convention already used by favorites.spec.ts/etc., since this project's testing-trophy
  // convention for authenticated flows is against a real local dev DB, not a mocked one.
  test("shows an authenticated visitor's real isFavorited state on first render, not a forced false (Story 1.6c AC7)", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run this authenticated hydration-correctness check.")

    await page.goto("/en/favorites")
    await expect(page.getByRole("heading", { level: 1, name: "My Favorites" })).toBeVisible()

    const firstCard = page.locator("article").first()
    await expect(firstCard).toBeVisible({ timeout: 15000 })
    const eventName = await firstCard.locator("h3").innerText()
    await firstCard.click()

    await expect(page).toHaveURL(/\/en\/events\/[a-z0-9-]+/)
    const modalTitle = page.locator("role=dialog").locator("h1")
    await expect(modalTitle).toHaveText(eventName)

    // The very first render of the "Remove from Favorites" (favorited=true) button state --
    // no intermediate "Add to Favorites" (favorited=false) flash corrected a moment later.
    const favoriteButton = page.locator("role=dialog").getByRole("button", { name: "Remove from Favorites" })
    await expect(favoriteButton).toBeVisible({ timeout: 2000 })
    await expect(favoriteButton).toHaveAttribute("aria-pressed", "true")
  })
})
