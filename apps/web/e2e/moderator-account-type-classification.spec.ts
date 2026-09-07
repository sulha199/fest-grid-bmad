import { test, expect } from "@playwright/test";

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe("Moderator account-type classification review E2E", () => {
  test("moderator resolves a pending account-type classification review and it disappears from the list", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to a moderator session to run the account-type classification review flow.");

    await page.goto("/en/moderator/items");

    // Wait for the page to load past the loading state
    await expect(page.getByRole("heading", { level: 1, name: "Moderator Items" })).toBeVisible();

    const classificationsSection = page.getByRole("heading", { level: 2, name: "Pending Account-Type Classifications" });
    await expect(classificationsSection).toBeVisible();

    // If the environment has no pending classification review awaiting review, there is nothing
    // to resolve -- this matches the sparse-data-tolerant style of this project's other E2E specs
    // (e.g. moderator-accounts.spec.ts), which don't seed fixtures via the DB directly.
    const emptyState = page.getByText("No pending account-type classifications awaiting review.");
    if (await emptyState.isVisible().catch(() => false)) {
      test.skip(true, "No pending account-type classification reviews available to resolve in this environment.");
    }

    // Resolve the first pending row via any of the 3 outcomes (Organizer/Venue/Event)
    const resolveButton = page.getByRole("button", { name: "Organizer/Venue/Event" }).first();
    await expect(resolveButton).toBeVisible();

    // Capture the row's account username to confirm it disappears afterward
    const row = resolveButton.locator("xpath=ancestor::div[contains(@class,'border') and contains(@class,'rounded-lg')][1]");
    const usernameLocator = row.locator("text=/^@/").first();
    const username = await usernameLocator.textContent();

    await resolveButton.click();

    await expect(page.getByText("Account-type classification successfully resolved")).toBeVisible();

    if (username) {
      await expect(page.getByText(username)).not.toBeVisible();
    }
  });
});
