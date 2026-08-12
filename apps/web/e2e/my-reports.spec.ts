import { test, expect } from "@playwright/test";

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe("My Reports E2E", () => {
  test("authenticated happy path: submit a report and verify it is listed on My Reports page", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run authenticated My Reports flow.");

    // Navigate to a seeded event page
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

    // Click 'Personal' reason radio item
    const personalLabel = page.locator("label", { hasText: "Personal" });
    await expect(personalLabel).toBeVisible();
    await personalLabel.click();

    // Optional details input
    const detailsInput = page.getByLabel("Additional details (optional)");
    await expect(detailsInput).toBeVisible();
    await detailsInput.fill("E2E my reports listing details");

    // Click Submit Report
    const submitBtn = page.getByRole("button", { name: "Submit Report" });
    await expect(submitBtn).not.toBeDisabled();
    await submitBtn.click();

    // Wait for success toast
    await expect(page.getByText("Report submitted successfully")).toBeVisible();

    // Navigate to /en/reports
    await page.goto("/en/reports");

    // Verify reports page title loads
    await expect(page.locator("h1", { hasText: "My Reports" })).toBeVisible();

    // Verify submitted report exists in the list
    await expect(page.locator("a", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible();
    await expect(page.getByText("Personal")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });
});
