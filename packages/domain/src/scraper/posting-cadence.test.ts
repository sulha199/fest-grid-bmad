import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_POSTING_DAYS_FOR_CADENCE,
  POSTING_CADENCE_WINDOW_DAYS,
  isScrapeDeferredByBackoff,
  resolveScrapeBackoffDays,
  summarizePostingCadence,
  type PostingCadence,
} from "./posting-cadence.js";

const now = new Date("2026-10-31T12:00:00.000Z");
const day = (isoDate: string, time = "10:00:00.000Z") => new Date(`${isoDate}T${time}`);

function cadence(overrides: Partial<PostingCadence> = {}): PostingCadence {
  return {
    postCount: 20,
    lastPostAt: day("2026-10-29"),
    silenceDays: 2,
    typicalGapDays: 2,
    postingDaysInWindow: 10,
    confidence: "ok",
    ...overrides,
  };
}

test("no post at all: nothing to read a rhythm from", () => {
  assert.deepEqual(summarizePostingCadence({ publishedAts: [], historySeeded: true, now }), {
    postCount: 0,
    lastPostAt: null,
    silenceDays: null,
    typicalGapDays: null,
    postingDaysInWindow: 0,
    confidence: "insufficient",
  });
});

test("the typical gap is the median between distinct posting days, so a burst on one day counts once", () => {
  // Ten posts on 10-19 (a burst), then 10-23, 10-25, 10-27: posting days 19, 23, 25, 27 -> gaps 4, 2, 2 -> median 2.
  const burst = Array.from({ length: 10 }, (_, index) => day("2026-10-19", `0${index}:00:00.000Z`));
  const result = summarizePostingCadence({
    publishedAts: [...burst, day("2026-10-23"), day("2026-10-25"), day("2026-10-27")],
    historySeeded: true,
    now,
  });
  assert.equal(result.typicalGapDays, 2);
  assert.equal(result.postingDaysInWindow, 4);
  assert.equal(result.postCount, 13);
  assert.equal(result.lastPostAt?.toISOString(), day("2026-10-27").toISOString());
  assert.equal(result.silenceDays, 4);
});

test("an even number of gaps takes the mean of the two middle ones", () => {
  // posting days 1, 2, 4 -> gaps 1, 2 -> median 1.5
  const result = summarizePostingCadence({
    publishedAts: [day("2026-10-01"), day("2026-10-02"), day("2026-10-04")],
    historySeeded: true,
    now,
  });
  assert.equal(result.typicalGapDays, 1.5);
});

test("a single posting day has no gap", () => {
  const result = summarizePostingCadence({ publishedAts: [day("2026-10-20"), day("2026-10-20", "18:00:00.000Z")], historySeeded: true, now });
  assert.equal(result.typicalGapDays, null);
  assert.equal(result.postingDaysInWindow, 1);
  assert.equal(result.confidence, "insufficient");
});

test("only the last active month counts: posting days older than the window before the last post are left out", () => {
  const result = summarizePostingCadence({
    publishedAts: [day("2026-08-01"), day("2026-08-03"), day("2026-10-20"), day("2026-10-22")],
    historySeeded: true,
    now,
  });
  assert.equal(POSTING_CADENCE_WINDOW_DAYS, 30);
  assert.equal(result.postingDaysInWindow, 2);
  assert.equal(result.typicalGapDays, 2);
});

test("confidence is ok only for a seeded profile with enough posting days in the window", () => {
  const days = ["2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26", "2026-10-28"].map((d) => day(d));
  assert.equal(MIN_POSTING_DAYS_FOR_CADENCE, 5);
  assert.equal(summarizePostingCadence({ publishedAts: days, historySeeded: true, now }).confidence, "ok");
  assert.equal(summarizePostingCadence({ publishedAts: days.slice(1), historySeeded: true, now }).confidence, "insufficient");
  // A co-author-only profile holds posts that say nothing about its own rhythm.
  assert.equal(summarizePostingCadence({ publishedAts: days, historySeeded: false, now }).confidence, "insufficient");
});

test("a post dated after now reads as no silence, never a negative one", () => {
  const result = summarizePostingCadence({ publishedAts: [day("2026-11-02")], historySeeded: true, now });
  assert.equal(result.silenceDays, 0);
});

test("the wait after an empty run is the typical gap, rounded up and capped", () => {
  const input = { lastRunWasEmpty: true, gapMultiplier: 1, maxDays: 3 };
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 2 }) }), 2);
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 1.5 }) }), 2);
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 9 }) }), 3, "capped at maxDays");
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 2 }), gapMultiplier: 2 }), 3);
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 1 }) }), 1, "a daily poster stays daily");
  assert.equal(resolveScrapeBackoffDays({ ...input, cadence: cadence({ typicalGapDays: 0 }) }), 1, "never below a day");
});

test("a cap of 1 turns the backoff off", () => {
  assert.equal(
    resolveScrapeBackoffDays({ cadence: cadence({ typicalGapDays: 5 }), lastRunWasEmpty: true, gapMultiplier: 1, maxDays: 1 }),
    1
  );
});

test("a run that found a new post, an unknown rhythm or a missing gap keeps the profile daily", () => {
  const base = { gapMultiplier: 1, maxDays: 3 };
  assert.equal(resolveScrapeBackoffDays({ ...base, cadence: cadence(), lastRunWasEmpty: false }), 1);
  assert.equal(resolveScrapeBackoffDays({ ...base, cadence: cadence({ confidence: "insufficient" }), lastRunWasEmpty: true }), 1);
  assert.equal(resolveScrapeBackoffDays({ ...base, cadence: cadence({ typicalGapDays: null }), lastRunWasEmpty: true }), 1);
});

test("a profile waits until intervalDays have passed since it was scraped, counted like the daily rule", () => {
  const cutoff = new Date("2026-10-31T02:13:00.000Z");
  const yesterday = new Date("2026-10-30T09:00:00.000Z");
  const twoDaysAgo = new Date("2026-10-29T09:00:00.000Z");
  assert.equal(isScrapeDeferredByBackoff({ lastScrapedAt: yesterday, cutoff, intervalDays: 2 }), true);
  assert.equal(isScrapeDeferredByBackoff({ lastScrapedAt: twoDaysAgo, cutoff, intervalDays: 2 }), false);
  assert.equal(isScrapeDeferredByBackoff({ lastScrapedAt: twoDaysAgo, cutoff, intervalDays: 3 }), true);
});

test("a daily interval and a never-scraped profile are never deferred", () => {
  const cutoff = new Date("2026-10-31T02:13:00.000Z");
  assert.equal(isScrapeDeferredByBackoff({ lastScrapedAt: new Date("2026-10-30T09:00:00.000Z"), cutoff, intervalDays: 1 }), false);
  assert.equal(isScrapeDeferredByBackoff({ lastScrapedAt: null, cutoff, intervalDays: 3 }), false);
});
