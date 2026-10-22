import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGHT_DATA_CURSOR_MARGIN_MS, resolveScrapeCursor } from "./resolve-scrape-cursor.js";

const newest = new Date("2026-10-20T15:30:00.000Z");
const fallback = "2026-10-13T00:00:00.000Z";

test("Apify starts exactly at the newest stored post", () => {
  assert.equal(
    resolveScrapeCursor({ vendor: "APIFY", newestPostPublishedAt: newest, fallbackNewerThan: fallback }),
    "2026-10-20T15:30:00.000Z"
  );
});

test("Bright Data starts one day before the newest stored post (time-zone margin)", () => {
  assert.equal(
    resolveScrapeCursor({ vendor: "BRIGHTDATA", newestPostPublishedAt: newest, fallbackNewerThan: fallback }),
    "2026-10-19T15:30:00.000Z"
  );
  assert.equal(BRIGHT_DATA_CURSOR_MARGIN_MS, 24 * 60 * 60 * 1000);
});

test("a profile with no stored post falls back to the caller's window, unchanged, for both vendors", () => {
  for (const vendor of ["APIFY", "BRIGHTDATA"] as const) {
    assert.equal(resolveScrapeCursor({ vendor, newestPostPublishedAt: null, fallbackNewerThan: fallback }), fallback);
    assert.equal(resolveScrapeCursor({ vendor, newestPostPublishedAt: undefined, fallbackNewerThan: fallback }), fallback);
  }
});

test("the cursor depends only on the stored posts: the same inputs always give the same cursor", () => {
  const first = resolveScrapeCursor({ vendor: "BRIGHTDATA", newestPostPublishedAt: newest, fallbackNewerThan: fallback });
  const second = resolveScrapeCursor({ vendor: "BRIGHTDATA", newestPostPublishedAt: newest, fallbackNewerThan: "2020-01-01T00:00:00.000Z" });
  assert.equal(first, second);
});
