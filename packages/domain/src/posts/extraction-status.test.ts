import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePostExtractionStatus, POST_EXTRACTION_STATUSES } from "./extraction-status.js";

const now = new Date("2026-01-01T01:00:00.000Z");
const TTL = 30;
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

const base = { isExtracted: false, queuedForExtractionAt: null, extractionStartedAt: null, hasEvent: false, extractionFailureReason: null };

test("lists the six statuses in display order", () => {
  assert.deepEqual(
    [...POST_EXTRACTION_STATUSES],
    ["PENDING", "QUEUED", "EXTRACTING", "ATTEMPT_FAILED", "PROMOTED", "NOT_EVENT"]
  );
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

test("a recorded failure with no claim is ATTEMPT_FAILED, not PENDING (AD-52 Rule 6)", () => {
  assert.equal(derivePostExtractionStatus({ ...base, extractionFailureReason: "unavailable" }, TTL, now), "ATTEMPT_FAILED");
});

test("a recorded failure whose claim outlived the TTL is still ATTEMPT_FAILED", () => {
  assert.equal(
    derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(31), extractionFailureReason: "blocked" }, TTL, now),
    "ATTEMPT_FAILED"
  );
});

test("a retry in flight (live claim) shows QUEUED or EXTRACTING even with a failure on record", () => {
  assert.equal(
    derivePostExtractionStatus({ ...base, queuedForExtractionAt: minutesAgo(5), extractionFailureReason: "unavailable" }, TTL, now),
    "QUEUED"
  );
  assert.equal(
    derivePostExtractionStatus(
      { ...base, queuedForExtractionAt: minutesAgo(5), extractionStartedAt: minutesAgo(4), extractionFailureReason: "unavailable" },
      TTL,
      now
    ),
    "EXTRACTING"
  );
});

test("an extracted post is never ATTEMPT_FAILED, even with a stale failure reason", () => {
  assert.equal(derivePostExtractionStatus({ ...base, isExtracted: true, hasEvent: true, extractionFailureReason: "x" }, TTL, now), "PROMOTED");
});
