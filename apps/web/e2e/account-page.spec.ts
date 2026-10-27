import { test, expect } from "@playwright/test";

test.describe("Public Account Page E2E", () => {
  test("should render public account page, show its events, navigate to detail view and click the attribution link back", async ({ page }) => {
    // Navigate directly to Jakarta City Events account page
    await page.goto("/en/ig/jktcity.events");

    // Check account page header shows displayName. Role-based, not locator("h1"): while Next streams the
    // page in, a hidden duplicate <h1> briefly sits in the DOM and would trip strict mode.
    const header = page.getByRole("heading", { level: 1 });
    await expect(header).toBeVisible({ timeout: 15000 });
    await expect(header).toHaveText("Jakarta City Events");

    // Wait for the seeded event card "Ongoing Culture Fest 2026-2027" to render.
    // Not "Past Jazz Night 2025" (Feb 2025, same account): Story 2.7's global
    // hide-past-events default (enforced server-side in the events resolver,
    // applying to every query path including this account page) now excludes
    // it, so it never renders here regardless of client-side state.
    const eventCard = page.locator("article", { hasText: "Ongoing Culture Fest 2026-2027" }).first();
    await expect(eventCard).toBeVisible({ timeout: 15000 });

    // Click the event card to open its detail view
    await eventCard.click();

    // Verify it navigates to the event detail page preserving list context
    await expect(page).toHaveURL(/\/en\/events\/ongoing-culture-fest-2026-2027-fixed\?fromList=account/);

    // The detail view opens as an intercepted-route modal (Story 1.6a) layered over
    // the still-mounted account page, so a bare page.locator("h1") is ambiguous
    // (matches both the account page's "Jakarta City Events" heading and the modal's
    // own title) — scope to the dialog, matching event-details.spec.ts's pattern.
    const detailTitle = page.getByRole("dialog").getByRole("heading", { level: 1 });
    await expect(detailTitle).toBeVisible();
    await expect(detailTitle).toHaveText("Ongoing Culture Fest 2026-2027");

    // Verify the account-attribution block is visible and shows correct display name
    const attributionLink = page.locator("role=dialog").locator("a", { hasText: "Jakarta City Events" });
    await expect(attributionLink).toBeVisible();

    // Click on the attribution link to navigate back to the account page
    await attributionLink.click();

    // Verify we are back on the public account page
    await expect(page).toHaveURL(/\/en\/ig\/jktcity\.events/);
    await expect(header).toHaveText("Jakarta City Events");
  });

  // Architecture Spine AD-35 Rule 5: the numeric account_id (and any non-canonical spelling) is
  // never the public URL; it 308-redirects to the username URL, keeping the query string.
  test("redirects a numeric account id URL to the username URL, preserving the query string", async ({ page }) => {
    await page.goto("/en/ig/2237970730?view=list");

    await expect(page).toHaveURL(/\/en\/ig\/pakuwonmall\.jogja\?view=list/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pakuwon Mall Jogja", { timeout: 15000 });
  });

  test("redirects a mixed-case username URL to the lower-case username URL", async ({ page }) => {
    await page.goto("/en/ig/JktCity.Events");

    await expect(page).toHaveURL(/\/en\/ig\/jktcity\.events$/);
  });
});
