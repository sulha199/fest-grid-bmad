import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_STATUSES, type JobStatus } from "./job-engine.js";
import { decideJobRetry } from "./job-retry.js";

// Story 10.4 (Part A) -- every row of the "Which reasons offer Retry" table.

const NOW = new Date("2026-11-13T10:00:00.000Z");
const base = { isOwner: true, status: "FAILED" as JobStatus, reasonCode: "TIMED_OUT" as string | null, hasRetryStarter: true, retryAfter: null, now: NOW };

test("retryable reasons offer Retry", () => {
  for (const reasonCode of [
    "NO_PROVIDER_REACHABLE", "PROVIDER_OVER_QUOTA", "TIMED_OUT", "WAITED_TOO_LONG", "CANCELLED", "SOME_POSTS_NOT_EXTRACTED", "VENDOR_RUN_FAILED",
    "REFRESH_IN_PROGRESS", "CHAIN_IN_FLIGHT", "QUOTA_EXHAUSTED", "EXTRACTION_FAILED", "REFRESH_DID_NOT_HEAL_IMAGES",
  ]) {
    assert.deepEqual(decideJobRetry({ ...base, reasonCode }), { canRetry: true, retryNotBefore: null }, reasonCode);
  }
});

test("reasons where the same input cannot help do not offer Retry", () => {
  for (const reasonCode of ["ACCOUNT_NOT_FOUND", "ACCOUNT_PRIVATE", "ACCOUNT_TYPE_NOT_SCRAPED", "POST_UNAVAILABLE", "POST_NOT_FOUND"]) {
    assert.deepEqual(decideJobRetry({ ...base, reasonCode }), { canRetry: false, retryNotBefore: null }, reasonCode);
  }
});

test("engine-internal, unknown and missing reasons read as a generic failure and offer Retry", () => {
  for (const reasonCode of ["HANDLER_ERROR", "HANDLER_NOT_REGISTERED", "HANDOFF_MISSING", "START_FAILED", "UNSPECIFIED", "SOMETHING_NEW", null]) {
    assert.equal(decideJobRetry({ ...base, reasonCode }).canRetry, true, String(reasonCode));
  }
});

test("COOLDOWN offers Retry from retryAfter while that is in the future, and at once when it is past or missing", () => {
  const later = new Date("2026-11-13T10:05:00.000Z");
  assert.deepEqual(decideJobRetry({ ...base, status: "SUCCEEDED_WITH_LIMITS", reasonCode: "COOLDOWN", retryAfter: later }), { canRetry: true, retryNotBefore: later });
  assert.deepEqual(decideJobRetry({ ...base, reasonCode: "COOLDOWN", retryAfter: new Date("2026-11-13T09:00:00.000Z") }), { canRetry: true, retryNotBefore: null });
  assert.deepEqual(decideJobRetry({ ...base, reasonCode: "COOLDOWN", retryAfter: null }), { canRetry: true, retryNotBefore: null });
});

test("only the owner, on an ended job that did not simply succeed, with a registered starter", () => {
  assert.equal(decideJobRetry({ ...base, isOwner: false }).canRetry, false);
  assert.equal(decideJobRetry({ ...base, hasRetryStarter: false }).canRetry, false);
  const open = JOB_STATUSES.filter((s) => s === "QUEUED" || s === "RUNNING" || s === "WAITING");
  for (const status of open) assert.equal(decideJobRetry({ ...base, status }).canRetry, false, status);
  assert.equal(decideJobRetry({ ...base, status: "SUCCEEDED", reasonCode: null }).canRetry, false);
  for (const status of ["SUCCEEDED_WITH_LIMITS", "FAILED", "EXPIRED"] as const) {
    assert.equal(decideJobRetry({ ...base, status }).canRetry, true, status);
  }
});
