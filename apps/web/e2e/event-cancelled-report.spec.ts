import { test, expect } from "@playwright/test";

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe("Event Cancellation Threshold E2E", () => {
  test("authenticated happy path: report event as 3rd user to trigger soft-delete and not-found redirection", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run authenticated event cancelled report threshold flow.");

    // 2.4 Navigate to the dedicated cancellation fixture event
    await page.goto("/en/events/cancellation-threshold-test-fixed");

    // Wait for event details to load
    await expect(page.locator("h1", { hasText: "Cancellation Threshold Test Event" })).toBeVisible();

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

    // Click 'Event Cancelled' reason label (reason-cancelled)
    const cancelledLabel = page.locator("label[htmlFor='reason-cancelled']");
    await expect(cancelledLabel).toBeVisible();
    await cancelledLabel.click();

    // Submit is now enabled
    await expect(submitBtn).not.toBeDisabled();
    await submitBtn.click();

    // 2.5 Assert success toast / dialog closing behavior
    await expect(page.getByText("Report submitted successfully")).toBeVisible();
    await expect(dialogTitle).not.toBeVisible();

    // After submitting, the event has reached the threshold (3rd report, as Alice & Bob are seeded)
    // and is soft-deleted synchronously. We should be redirected or navigated away immediately.
    // 2.6 Re-navigate to the same URL to verify it now displays the Not Found state.
    await page.goto("/en/events/cancellation-threshold-test-fixed");

    // We should see the generic "Not Found" state (from EventDetailWrapper.tsx / EventDetailsPage namespace)
    // t("notFoundTitle") / t("notFoundBody")
    // By default: "Event Not Found" / "This event does not exist, has been removed, or is no longer active."
    const notFoundTitle = page.locator("h2, h1, div, p", { hasText: "Event Not Found" });
    await expect(notFoundTitle).toBeVisible();

    const notFoundBody = page.locator("p, div", { hasText: "This event does not exist, has been removed, or is no longer active." });
    await expect(notFoundBody).toBeVisible();
  });
});

// 2.7 Note: This dedicated cancellation fixture event stays permanently soft-deleted after this spec runs unless a moderator restores it.
