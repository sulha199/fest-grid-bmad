import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_JOBS_HISTORY_RETENTION_DAYS, deriveJobOutcome, jobHistoryCutoff } from "./job-history.js";

// Story 10.4 (Part A) -- retention cutoff (hide-only) and the outcome of a finished job.

test("the cutoff is the retention in days before now", () => {
  assert.equal(DEFAULT_JOBS_HISTORY_RETENTION_DAYS, 30);
  assert.equal(jobHistoryCutoff(new Date("2026-11-13T10:00:00.000Z"), 30).toISOString(), "2026-10-14T10:00:00.000Z");
  assert.equal(jobHistoryCutoff(new Date("2026-11-13T10:00:00.000Z"), 1).toISOString(), "2026-11-12T10:00:00.000Z");
});

test("a preview outcome carries the Apply window end and whether it was applied", () => {
  const finishedAt = new Date("2026-11-13T10:00:00.000Z");
  assert.deepEqual(deriveJobOutcome({ outcomeKind: "PREVIEW", status: "SUCCEEDED", finishedAt, previewApplied: true }), {
    kind: "PREVIEW", eventCount: null, postCount: null, previewApplyUntil: new Date("2026-11-13T10:30:00.000Z"), previewApplied: true,
  });
  assert.equal(deriveJobOutcome({ outcomeKind: "PREVIEW", status: "SUCCEEDED_WITH_LIMITS", finishedAt: null, previewApplied: false })?.previewApplyUntil, null);
});

test("a non-preview outcome has no apply fields; no outcome unless the job succeeded and has a kind", () => {
  const finishedAt = new Date();
  assert.deepEqual(deriveJobOutcome({ outcomeKind: "ACCOUNT", status: "SUCCEEDED", finishedAt, previewApplied: false }), {
    kind: "ACCOUNT", eventCount: null, postCount: null, previewApplyUntil: null, previewApplied: null,
  });
  assert.equal(deriveJobOutcome({ outcomeKind: "NONE", status: "SUCCEEDED", finishedAt, previewApplied: false }), null);
  for (const status of ["QUEUED", "RUNNING", "WAITING", "FAILED", "EXPIRED"] as const) {
    assert.equal(deriveJobOutcome({ outcomeKind: "PREVIEW", status, finishedAt, previewApplied: false }), null, status);
  }
});
