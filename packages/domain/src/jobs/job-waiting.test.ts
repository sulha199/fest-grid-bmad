import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_STATUSES } from "./job-engine.js";
import { deriveJobWaiting } from "./job-waiting.js";

// Story 10.4 (Part A) -- what a WAITING job waits for.

test("only a WAITING job has waiting info", () => {
  for (const status of JOB_STATUSES.filter((s) => s !== "WAITING")) {
    assert.equal(deriveJobWaiting({ status, resumeAt: new Date() }), null, status);
  }
});

test("a WAITING job with a resume time waits for its retry; without one it waits for a result", () => {
  const at = new Date("2026-11-13T14:20:00.000Z");
  assert.deepEqual(deriveJobWaiting({ status: "WAITING", resumeAt: at }), { waitingFor: "RETRY_AT", resumeAt: at, done: null, total: null });
  assert.deepEqual(deriveJobWaiting({ status: "WAITING", resumeAt: null }), { waitingFor: "RESULT_FROM_PROVIDER", resumeAt: null, done: null, total: null });
});
