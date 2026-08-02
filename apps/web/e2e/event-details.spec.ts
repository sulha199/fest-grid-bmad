import { test, expect } from "@playwright/test"

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
})
