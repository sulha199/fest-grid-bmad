import { test, expect, type Page, type Request } from "@playwright/test";

// Seeded fixture (packages/database/seed.ts): an event with two schedules. Signed in as the plain seeded
// user (E2E_FAKE_AUTH=1 provides the storage state) -- adding to a calendar needs a session.
const EVENT_SLUG = "upcoming-family-workshop-2027-fixed";
const storageStatePath = process.env.E2E_AUTH_USER_STORAGE_STATE ?? process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

// The two tests share one user's calendar rows, so they must not interleave.
test.describe.configure({ mode: "serial" });

type CalendarOperation = { name: "setCalendarAdditions" | "toggleCalendarAddition"; variables: Record<string, unknown> };

function trackCalendarRequests(page: Page): CalendarOperation[] {
  const seen: CalendarOperation[] = [];
  page.on("request", (request: Request) => {
    if (!request.url().includes("/api/graphql") || request.method() !== "POST") return;
    try {
      const body = JSON.parse(request.postData() ?? "{}") as { query?: string; variables?: Record<string, unknown> };
      const match = /mutation\s+(setCalendarAdditions|toggleCalendarAddition)\b/.exec(body.query ?? "");
      if (match) seen.push({ name: match[1] as CalendarOperation["name"], variables: body.variables ?? {} });
    } catch {
      // not a JSON GraphQL request
    }
  });
  return seen;
}

function trackDownloads(page: Page): string[] {
  const urls: string[] = [];
  page.on("download", (download) => urls.push(download.url()));
  return urls;
}

async function openEvent(page: Page) {
  await page.goto(`/en/events/${EVENT_SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: "Upcoming Family Workshop 2027" })).toBeVisible();
  const icons = page.getByRole("button", { name: "Add to Calendar", exact: true }).filter({ has: page.locator("svg") });
  await expect(icons).toHaveCount(2);
  return icons;
}

/** Start every test from "nothing added" so assertions don't depend on a previous run. */
async function removeAllAdded(page: Page, icons: ReturnType<Page["getByRole"]>) {
  for (let i = 0; i < 2; i++) {
    if ((await icons.nth(i).getAttribute("aria-pressed")) === "true") {
      const saved = page.waitForResponse((r) => r.url().includes("/api/graphql") && (r.request().postData() ?? "").includes("CalendarAddition"));
      await icons.nth(i).click();
      await saved;
      await expect(icons.nth(i)).toHaveAttribute("aria-pressed", "false");
    }
  }
}

test.describe("Add to calendar -- batch mutation and .ics download (seed: " + EVENT_SLUG + ")", () => {
  test("per-schedule icon: one batched request per click, toggle-on always downloads, others stay added", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_FAKE_AUTH=1 (or E2E_AUTH_USER_STORAGE_STATE) to run the signed-in calendar flow.");

    const icons = await openEvent(page);
    await removeAllAdded(page, icons);

    const operations = trackCalendarRequests(page);
    const downloads = trackDownloads(page);

    // 1. Toggle schedule 1 ON: one batched request, one .ics for exactly that schedule.
    const firstDownload = page.waitForEvent("download");
    // When each request LEAVES the browser, relative to the click -- shows the .ics is requested right
    // away rather than after the save (the download event itself only fires once the .ics response
    // headers arrive, which includes the server's time to build it).
    const started = Date.now();
    const sentAt: Record<string, number> = {};
    page.on("request", (r) => {
      if (r.url().includes("/api/calendar/ics")) sentAt.ics ??= Date.now() - started;
      if (r.url().includes("/api/graphql") && (r.postData() ?? "").includes("setCalendarAdditions")) sentAt.mutation ??= Date.now() - started;
    });
    const mutationDone = page.waitForResponse((r) => r.url().includes("/api/graphql") && (r.request().postData() ?? "").includes("setCalendarAdditions"));
    await icons.nth(0).click();
    const download1 = await firstDownload;
    const mutationResponse = await mutationDone;
    console.log(`[timing] after click: .ics request sent +${sentAt.ics}ms, setCalendarAdditions sent +${sentAt.mutation}ms, mutation round trip ${mutationResponse.request().timing().responseEnd.toFixed(0)}ms, download event +${Date.now() - started}ms`);
    expect(sentAt.ics).toBeLessThanOrEqual(sentAt.mutation + 50);
    expect(download1.url()).toContain(`/api/calendar/ics?eventId=`);
    expect(download1.suggestedFilename()).toBe(`${EVENT_SLUG}.ics`);
    await expect(icons.nth(0)).toHaveAttribute("aria-pressed", "true");
    expect(operations).toHaveLength(1);
    expect(operations[0].name).toBe("setCalendarAdditions");
    expect((operations[0].variables.changes as unknown[]).length).toBe(1);

    // 2. Toggle schedule 2 ON: downloads again, and schedule 1 must still be added (regression: the icon
    // used to send only [thisScheduleId], which un-added every other added schedule).
    const secondDownload = page.waitForEvent("download");
    await icons.nth(1).click();
    await secondDownload;
    await expect(icons.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(icons.nth(0)).toHaveAttribute("aria-pressed", "true");
    expect(downloads).toHaveLength(2);
    expect(downloads[0]).not.toBe(downloads[1]);

    // 3. Toggle schedule 1 OFF: no download; schedule 2 stays added.
    await icons.nth(0).click();
    await expect(icons.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(icons.nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1500);
    expect(downloads).toHaveLength(2);

    // Every click was exactly one batch request; the old per-schedule mutation is never used.
    expect(operations.map((o) => o.name)).toEqual(["setCalendarAdditions", "setCalendarAdditions", "setCalendarAdditions"]);

    // 4. The server really persisted it: a fresh load shows schedule 2 added, schedule 1 not.
    await page.reload();
    await expect(icons.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(icons.nth(1)).toHaveAttribute("aria-pressed", "true");

    await removeAllAdded(page, icons);
  });

  test("dialog: confirming two schedules sends ONE request and downloads ONE .ics covering both", async ({ page }) => {
    test.skip(!storageStatePath, "Set E2E_FAKE_AUTH=1 (or E2E_AUTH_USER_STORAGE_STATE) to run the signed-in calendar flow.");

    const icons = await openEvent(page);
    await removeAllAdded(page, icons);

    const operations = trackCalendarRequests(page);
    const downloads = trackDownloads(page);

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Add to Calendar" }).click();
    const dialog = page.getByRole("dialog", { name: "Add to Calendar" });
    await expect(dialog).toBeVisible();
    for (const checkbox of await dialog.getByRole("checkbox").all()) {
      await checkbox.check();
    }

    const download = page.waitForEvent("download");
    const started = Date.now();
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await download;
    await expect(dialog).toBeHidden();
    console.log(`[timing] dialog confirm -> dialog closed with ${(operations[0]?.variables.changes as unknown[] | undefined)?.length ?? 0} changes in ${Date.now() - started}ms`);

    expect(operations).toHaveLength(1);
    expect(operations[0].name).toBe("setCalendarAdditions");
    const changes = operations[0].variables.changes as { scheduleId: string; isAddedToCalendar: boolean }[];
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.isAddedToCalendar)).toBe(true);

    expect(downloads).toHaveLength(1);
    const scheduleIds = new URL(downloads[0], "http://localhost").searchParams.getAll("scheduleId");
    expect(scheduleIds.sort()).toEqual(changes.map((c) => String(c.scheduleId)).sort());

    await expect(icons.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(icons.nth(1)).toHaveAttribute("aria-pressed", "true");

    await removeAllAdded(page, icons);
  });
});
