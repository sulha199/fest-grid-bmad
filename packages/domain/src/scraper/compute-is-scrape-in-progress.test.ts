import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIsScrapeInProgress } from "./compute-is-scrape-in-progress.js";

const now = new Date("2026-01-10T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

test("never triggered is not in progress", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: null, lastScrapedAt: null }, 3, now), false);
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: null, lastScrapedAt: hoursAgo(1) }, 3, now), false);
});

test("triggered recently with no completed scrape is in progress", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(1), lastScrapedAt: null }, 3, now), true);
});

test("triggered recently and the last completed scrape predates the trigger is in progress", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(1), lastScrapedAt: hoursAgo(20) }, 3, now), true);
});

test("a scrape that completed after the trigger is no longer in progress", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(2), lastScrapedAt: hoursAgo(1) }, 3, now), false);
});

test("a trigger older than the timeout is an orphaned job, whatever lastScrapedAt says", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(4), lastScrapedAt: null }, 3, now), false);
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(4), lastScrapedAt: hoursAgo(10) }, 3, now), false);
});

test("a trigger exactly at the timeout boundary still counts as in progress", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: hoursAgo(3), lastScrapedAt: null }, 3, now), true);
});

test("defaults now to the current time", () => {
  assert.equal(computeIsScrapeInProgress({ scrapeTriggeredAt: new Date(), lastScrapedAt: null }, 3), true);
});
