import { test } from "node:test";
import assert from "node:assert/strict";
import { APIFY_CURSOR_ADVANCE_MS, BRIGHT_DATA_CURSOR_MARGIN_MS, HISTORY_SEED_LOOKBACK_DAYS, resolveScrapeCursor } from "./resolve-scrape-cursor.js";

const newest = new Date("2026-10-20T15:30:00.000Z");
const fallback = "2026-10-13T00:00:00.000Z";

test("Apify starts one second after the newest stored post, because its filter includes the boundary", () => {
  // `onlyPostsNewerThan` returns a post published exactly at the filter (prod 2026-10-23..29: 133 items
  // were the newest known post fetched again), so the cursor steps past it.
  assert.equal(
    resolveScrapeCursor({ vendor: "APIFY", historySeeded: true, newestPostPublishedAt: newest, fallbackNewerThan: fallback }),
    "2026-10-20T15:30:01.000Z"
  );
  assert.equal(APIFY_CURSOR_ADVANCE_MS, 1000);
});

test("Bright Data starts one day before the newest stored post (time-zone margin)", () => {
  assert.equal(
    resolveScrapeCursor({ vendor: "BRIGHTDATA", historySeeded: true, newestPostPublishedAt: newest, fallbackNewerThan: fallback }),
    "2026-10-19T15:30:00.000Z"
  );
  assert.equal(BRIGHT_DATA_CURSOR_MARGIN_MS, 24 * 60 * 60 * 1000);
});

test("a profile with no stored post falls back to the caller's window, unchanged, for both vendors", () => {
  for (const vendor of ["APIFY", "BRIGHTDATA"] as const) {
    assert.equal(resolveScrapeCursor({ vendor, historySeeded: true, newestPostPublishedAt: null, fallbackNewerThan: fallback }), fallback);
    assert.equal(resolveScrapeCursor({ vendor, historySeeded: true, newestPostPublishedAt: undefined, fallbackNewerThan: fallback }), fallback);
  }
});

test("the cursor depends only on the stored posts: the same inputs always give the same cursor", () => {
  const first = resolveScrapeCursor({ vendor: "BRIGHTDATA", historySeeded: true, newestPostPublishedAt: newest, fallbackNewerThan: fallback });
  const second = resolveScrapeCursor({ vendor: "BRIGHTDATA", historySeeded: true, newestPostPublishedAt: newest, fallbackNewerThan: "2020-01-01T00:00:00.000Z" });
  assert.equal(first, second);
});

test("a stored post dated in the future is treated as published now, so it cannot push the cursor ahead", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const future = new Date("2026-11-30T00:00:00.000Z");
  assert.equal(
    resolveScrapeCursor({ vendor: "APIFY", historySeeded: true, newestPostPublishedAt: future, fallbackNewerThan: fallback, now }),
    "2026-10-22T12:00:00.000Z"
  );
  assert.equal(
    resolveScrapeCursor({ vendor: "BRIGHTDATA", historySeeded: true, newestPostPublishedAt: future, fallbackNewerThan: fallback, now }),
    "2026-10-21T12:00:00.000Z"
  );
});

test("a post published before now is used as it is", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  assert.equal(
    resolveScrapeCursor({ vendor: "APIFY", historySeeded: true, newestPostPublishedAt: newest, fallbackNewerThan: fallback, now }),
    "2026-10-20T15:30:01.000Z"
  );
});

test("Apify's one-second step never takes the cursor past now", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  assert.equal(
    resolveScrapeCursor({ vendor: "APIFY", historySeeded: true, newestPostPublishedAt: now, fallbackNewerThan: fallback, now }),
    "2026-10-22T12:00:00.000Z"
  );
});

test("a profile whose history is not seeded starts HISTORY_SEED_LOOKBACK_DAYS back, whatever posts it holds", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  assert.equal(HISTORY_SEED_LOOKBACK_DAYS, 30);
  for (const vendor of ["APIFY", "BRIGHTDATA"] as const) {
    // A co-author-only profile holds a post from yesterday; starting after it would skip the profile's own timeline.
    const yesterday = new Date("2026-10-30T12:00:00.000Z");
    assert.equal(
      resolveScrapeCursor({ vendor, historySeeded: false, newestPostPublishedAt: yesterday, fallbackNewerThan: fallback, now }),
      "2026-10-01T12:00:00.000Z"
    );
    assert.equal(
      resolveScrapeCursor({ vendor, historySeeded: false, newestPostPublishedAt: undefined, fallbackNewerThan: fallback, now }),
      "2026-10-01T12:00:00.000Z"
    );
  }
});
