import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXTRACTION_CURSOR_VERSION, type ExtractionCursor } from "./extraction-cursor.js";
import { parseExtractionCursor } from "./extraction-cursor-schema.js";

const sampleCursor = (overrides: Partial<ExtractionCursor> = {}): ExtractionCursor => ({
  version: EXTRACTION_CURSOR_VERSION,
  postId: "post-1",
  stepCount: 1,
  leaseNonce: "nonce-a",
  nextSlide: 6,
  totalImages: 14,
  unreadAtStart: 8,
  unreadImageUrls: ["https://cdn.example/6.jpg", "https://cdn.example/7.jpg"],
  nextOrdinal: 26,
  foundKeys: ["jazz night|2027-01-05"],
  groupingReason: "roundup",
  followUpMade: false,
  emptySteps: 0,
  windowSize: 2,
  requestsMade: 0,
  resumeAttempts: 0,
  rescrapeCount: 0,
  lastRescrapeAt: null,
  itemsPerSlide: 5,
  claimedItemCount: 203,
  ...overrides,
});

describe("parseExtractionCursor", () => {
  it("accepts a well-formed current-version cursor and returns it unchanged", () => {
    const cursor = sampleCursor();
    assert.deepEqual(parseExtractionCursor(JSON.parse(JSON.stringify(cursor))), cursor);
  });

  it("accepts the null-able fields as null", () => {
    const cursor = sampleCursor({ groupingReason: null, itemsPerSlide: null, claimedItemCount: null, lastRescrapeAt: "2026-11-10T00:00:00.000Z" });
    assert.deepEqual(parseExtractionCursor(cursor), cursor);
  });

  it("rejects anything that is not a cursor", () => {
    for (const value of [null, undefined, 42, "x", [], {}, JSON.stringify(sampleCursor())]) {
      assert.equal(parseExtractionCursor(value), null, String(value));
    }
  });

  it("rejects another version, a missing field, a wrong type and an unknown field", () => {
    assert.equal(parseExtractionCursor({ ...sampleCursor(), version: 2 }), null);
    const missing: Record<string, unknown> = { ...sampleCursor() };
    delete missing.leaseNonce;
    assert.equal(parseExtractionCursor(missing), null);
    assert.equal(parseExtractionCursor({ ...sampleCursor(), stepCount: "1" }), null);
    assert.equal(parseExtractionCursor({ ...sampleCursor(), stepCount: -1 }), null);
    assert.equal(parseExtractionCursor({ ...sampleCursor(), caption: "must never be stored" }), null, "a caption can never ride along");
    assert.equal(parseExtractionCursor({ ...sampleCursor(), groupingReason: "party" }), null);
  });
});
