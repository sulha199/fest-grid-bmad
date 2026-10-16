import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAccountActivityState, ACCOUNT_ACTIVITY_STATES } from "./compute-account-activity-state.js";

const now = new Date("2026-02-01T12:00:00.000Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const thresholds = { scrapeInProgressTimeoutHours: 3, scrapeStaleDays: 3, inactiveAfterDays: 30 };
const idle = { lastScrapedAt: null, scrapeTriggeredAt: null, newestPostAt: null };

test("lists the states", () => {
  assert.deepEqual([...ACCOUNT_ACTIVITY_STATES], ["ACTIVE", "NEVER_SCRAPED", "SCRAPE_IN_PROGRESS", "SCRAPE_STALE", "INACTIVE"]);
});

test("a scrape in flight wins over everything, even with no posts and no completed scrape", () => {
  assert.equal(computeAccountActivityState({ ...idle, scrapeTriggeredAt: hoursAgo(1) }, thresholds, now), "SCRAPE_IN_PROGRESS");
  assert.equal(
    computeAccountActivityState({ lastScrapedAt: daysAgo(60), scrapeTriggeredAt: hoursAgo(1), newestPostAt: daysAgo(90) }, thresholds, now),
    "SCRAPE_IN_PROGRESS"
  );
});

test("an orphaned trigger (older than the timeout) does not count as in progress", () => {
  assert.equal(computeAccountActivityState({ ...idle, scrapeTriggeredAt: hoursAgo(5) }, thresholds, now), "NEVER_SCRAPED");
});

test("never scraped is NEVER_SCRAPED, not inactive, even with posts that predate the subscription", () => {
  assert.equal(computeAccountActivityState(idle, thresholds, now), "NEVER_SCRAPED");
  assert.equal(computeAccountActivityState({ ...idle, newestPostAt: daysAgo(100) }, thresholds, now), "NEVER_SCRAPED");
});

test("a last successful scrape older than the stale window is SCRAPE_STALE, not inactive", () => {
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: daysAgo(4), newestPostAt: daysAgo(90) }, thresholds, now), "SCRAPE_STALE");
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: daysAgo(4) }, thresholds, now), "SCRAPE_STALE");
});

test("a last scrape exactly at the stale boundary is still recent", () => {
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: daysAgo(3), newestPostAt: daysAgo(90) }, thresholds, now), "INACTIVE");
});

test("recently scraped with no posts at all is INACTIVE", () => {
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: hoursAgo(2) }, thresholds, now), "INACTIVE");
});

test("recently scraped with the newest post older than the inactivity window is INACTIVE", () => {
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: hoursAgo(2), newestPostAt: daysAgo(31) }, thresholds, now), "INACTIVE");
});

test("recently scraped with a post inside the window is ACTIVE; the exact boundary is still active", () => {
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: hoursAgo(2), newestPostAt: daysAgo(5) }, thresholds, now), "ACTIVE");
  assert.equal(computeAccountActivityState({ ...idle, lastScrapedAt: hoursAgo(2), newestPostAt: daysAgo(30) }, thresholds, now), "ACTIVE");
});

test("defaults now to the current time", () => {
  assert.equal(
    computeAccountActivityState({ lastScrapedAt: new Date(), scrapeTriggeredAt: null, newestPostAt: new Date() }, thresholds),
    "ACTIVE"
  );
});
