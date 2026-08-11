import { test, expect } from "@playwright/test";

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe("Event Correction E2E", () => {
  test("authenticated happy path: open more actions, click Correct Data, edit field, submit and assert success toast", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run authenticated event correction flow.");

    // Navigate to an event page that is seeded
    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed");

    // Wait for event title to load
    await expect(page.locator("h1", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible();

    // Click "More actions" overflow trigger
    const moreBtn = page.getByRole("button", { name: "More actions" });
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    // Click "Correct Data"
    const correctBtn = page.getByRole("menuitem", { name: "Correct Data" });
    await expect(correctBtn).toBeVisible();
    await correctBtn.click();

    // Check dialog opens and renders CorrectionForm
    const dialogTitle = page.getByRole("heading", { name: "Correct Event Data" });
    await expect(dialogTitle).toBeVisible();

    // Edit event name input
    const eventNameInput = page.getByLabel("Event Name");
    await expect(eventNameInput).toBeVisible();
    await eventNameInput.fill("Ongoing Culture Fest 2026-2027 Edited");

    // Click Submit
    const submitBtn = page.getByRole("button", { name: "Submit Correction" });
    await submitBtn.click();

    // Wait for success toast
    await expect(page.getByText("Correction submitted successfully")).toBeVisible();

    // Verify dialog closed
    await expect(dialogTitle).not.toBeVisible();

    // Verify the page title updated immediately (patched React Query cache)
    await expect(page.locator("h1")).toHaveText("Ongoing Culture Fest 2026-2027 Edited");
  });
});
