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

  test("authenticated AI-assisted correction path: click AI-Assisted Correction, enter URL, extract, and submit", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_AUTH_STORAGE_STATE to run authenticated event correction flow.");

    // Mock the extractEventDataFromUrl mutation
    await page.route("**/api/graphql", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      if (postData && postData.query && postData.query.includes("extractEventDataFromUrl")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              extractEventDataFromUrl: {
                data: {
                  eventName: "AI Extracted Event",
                  types: ["FESTIVAL"],
                  categories: ["MUSIC"],
                  location: "AI Extracted Location",
                  organizerName: "AI Extracted Organizer",
                  contactInfo: "ai@extracted.com",
                  description: "AI Extracted Description",
                  schedules: [
                    {
                      isMainSchedule: true,
                      eventStartDate: "2026-11-20",
                      eventEndDate: "2026-11-22",
                      eventStartTime: "12:00",
                      eventEndTime: "21:00",
                      title: "AI Extracted Stage",
                      performers: ["AI Artist"],
                      location: "AI Extracted Sched Loc",
                      ticketPrice: "$88",
                    },
                  ],
                },
                errorCode: null,
                errorMessage: null,
              },
            },
          }),
        });
      }

      return route.continue();
    });

    // Navigate to an event page that is seeded
    await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed");

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

    // Click "AI-Assisted Correction"
    const aiBtn = page.getByRole("button", { name: "AI-Assisted Correction" });
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();

    // Fill in URL input
    const urlInput = page.getByLabel("Social media post URL");
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://instagram.com/p/123");

    // Click "Extract"
    const extractBtn = page.getByRole("button", { name: "Extract" });
    await expect(extractBtn).toBeVisible();
    await extractBtn.click();

    // Wait for the form fields to be updated with extracted event name
    const eventNameInput = page.getByLabel("Event Name");
    await expect(eventNameInput).toHaveValue("AI Extracted Event");

    // Click Submit
    const submitBtn = page.getByRole("button", { name: "Submit Correction" });
    await submitBtn.click();

    // Wait for success toast
    await expect(page.getByText("Correction submitted successfully")).toBeVisible();

    // Verify dialog closed
    await expect(dialogTitle).not.toBeVisible();

    // Verify React Query patch
    await expect(page.locator("h1")).toHaveText("AI Extracted Event");
  });
});
