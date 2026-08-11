import { test, expect } from "@playwright/test";

test.describe("Public Account Page E2E", () => {
  test("should render public account page, show its events, navigate to detail view and click the attribution link back", async ({ page }) => {
    // Navigate directly to Jakarta City Events account page
    await page.goto("/en/ig/ig_jkt_events");

    // Check account page header shows displayName
    const header = page.locator("h1");
    await expect(header).toBeVisible({ timeout: 15000 });
    await expect(header).toHaveText("Jakarta City Events");

    // Wait for the seeded event card "Past Jazz Night 2025" to render
    const eventCard = page.locator("article", { hasText: "Past Jazz Night 2025" }).first();
    await expect(eventCard).toBeVisible({ timeout: 15000 });

    // Click the event card to open its detail view
    await eventCard.click();

    // Verify it navigates to the event detail page preserving list context
    await expect(page).toHaveURL(/\/en\/events\/past-jazz-night-2025-fixed\?fromList=account/);

    // Verify event details title is correct
    const detailTitle = page.locator("h1");
    await expect(detailTitle).toBeVisible();
    await expect(detailTitle).toHaveText("Past Jazz Night 2025");

    // Verify the account-attribution block is visible and shows correct display name
    const attributionLink = page.locator("a", { hasText: "Jakarta City Events" });
    await expect(attributionLink).toBeVisible();

    // Click on the attribution link to navigate back to the account page
    await attributionLink.click();

    // Verify we are back on the public account page
    await expect(page).toHaveURL(/\/en\/ig\/ig_jkt_events/);
    await expect(header).toHaveText("Jakarta City Events");
  });
});
