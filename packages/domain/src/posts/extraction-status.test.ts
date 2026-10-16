import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePostExtractionStatus, POST_EXTRACTION_STATUSES } from "./extraction-status.js";

const now = new Date("2026-01-01T01:00:00.000Z");
const TTL = 30;
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

const base = { isExtracted: false, queuedForExtractionAt: null, extractionStartedAt: null, hasEvent: false };

test("lists the five statuses in display order", () => {
  assert.deepEqual([...POST_EXTRACTION_STATUSES], ["PENDING", "QUEUED", "EXTRACTING", "PROMOTED", "NOT_EVENT"]);
});

test("extracted with an event is PROMOTED, regardless of any leftover claim", () => {
  assert.equal(
    derivePostExtractionStatus({ ...base, isExtracted: true, hasEvent: true, queuedForExtractionAt: minutesAgo(1) }, TTL, now),
    "PROMOTED"
  );
});

test("extracted without an event is NOT_EVENT", () => {
  assert.equal(derivePostExtractionStatus({ ...base, isExtracted: true, hasEvent: false }, TTL, now), "NOT_EVENT");
});

test("never queued is PENDING", () => {
  assert.equal(derivePostExtractionStatus(base, TTL, now), "PENDING");
});

test("a claim past the TTL is reclaimable, so PENDING again, even if processing had started", () => {
  assert.equal(
    derivePostExtractionStatus(
      { ...base, queuedForExtractionAt: minutesAgo(31), extractionStartedAt: minutesAgo(30) },
      TTL,
      now
    ),
    "PENDING"
  );
});

test("a claim exactly TTL old is still live (mirrors the `< cutoff` SQL reclaim predicate)", () => {
  assert.equal(derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(30) }, TTL, now), "QUEUED");
});

test("a live claim that processing has not started is QUEUED", () => {
  assert.equal(derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(5) }, TTL, now), "QUEUED");
});

test("a live claim with processing started at or after the claim is EXTRACTING", () => {
  assert.equal(
    derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(5), extractionStartedAt: minutesAgo(4) }, TTL, now),
    "EXTRACTING"
  );
  assert.equal(
    derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(5), extractionStartedAt: minutesAgo(5) }, TTL, now),
    "EXTRACTING"
  );
});

test("processing started BEFORE a newer claim (a re-queue) is QUEUED again", () => {
  assert.equal(
    derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(2), extractionStartedAt: minutesAgo(20) }, TTL, now),
    "QUEUED"
  );
});
