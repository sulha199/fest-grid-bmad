import { test, expect } from "@playwright/test";

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe("Event Reporting E2E", () => {
  test("authenticated happy path: open overflow menu, click Report, select reason, submit, assert success and hidden view", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run authenticated event reporting flow.");

    // Navigate to an event page that is seeded
    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed");

    // Wait for event title to load
    await expect(page.locator("h1", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible();

    // Click "More actions" overflow trigger
    const moreBtn = page.getByRole("button", { name: "More actions" });
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    // Click "Report"
    const reportBtn = page.getByRole("menuitem", { name: "Report" });
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    // Check dialog opens and renders Report Dialog
    const dialogTitle = page.getByRole("heading", { name: "Report Event" });
    await expect(dialogTitle).toBeVisible();

    // Submit button is disabled initially
    const submitBtn = page.getByRole("button", { name: "Submit Report" });
    await expect(submitBtn).toBeDisabled();

    // Click 'Personal' reason radio item
    const personalLabel = page.locator("label", { hasText: "Personal" });
    await expect(personalLabel).toBeVisible();
    await personalLabel.click();

    // Optional details input
    const detailsInput = page.getByLabel("Additional details (optional)");
    await expect(detailsInput).toBeVisible();
    await detailsInput.fill("E2E test reporting details");

    // Submit is now enabled
    await expect(submitBtn).not.toBeDisabled();
    await submitBtn.click();

    // Wait for success toast
    await expect(page.getByText("Report submitted successfully")).toBeVisible();

    // Verify dialog closed
    await expect(dialogTitle).not.toBeVisible();

    // Verify page immediately transitioned to "This event is no longer available to you" state
    const hiddenTitle = page.getByRole("heading", { name: "This event is no longer available to you" });
    await expect(hiddenTitle).toBeVisible();
  });
});
