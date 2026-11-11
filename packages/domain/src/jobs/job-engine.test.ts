import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_STATUSES,
  JOB_TERMINAL_STATUSES,
  JOB_TRIGGERS,
  computeJobDeadline,
  getJobTypeDefinition,
  isPlaceHoldingJobStatus,
  isTerminalJobStatus,
  registerJobTypeDefinition,
  resolveAttemptBudgetMs,
  type JobStatus,
  type JobTypeDefinition,
} from "./job-engine.js";

// Story 10.1a -- the pure contract of the job engine (PRD 3.18 and 4.21: FR117 statuses, FR121 places, FR130 trigger).

test("job statuses and triggers are the closed PRD sets", () => {
  assert.deepEqual([...JOB_STATUSES], [
    "QUEUED", "RUNNING", "WAITING", "SUCCEEDED", "SUCCEEDED_WITH_LIMITS", "FAILED", "EXPIRED",
  ]);
  assert.deepEqual([...JOB_TRIGGERS], ["USER", "SYSTEM"]);
  assert.deepEqual([...JOB_TERMINAL_STATUSES], ["SUCCEEDED", "SUCCEEDED_WITH_LIMITS", "FAILED", "EXPIRED"]);
});

test("isTerminalJobStatus: exactly the four endings are terminal (FR117)", () => {
  const terminal = JOB_STATUSES.filter((s: JobStatus) => isTerminalJobStatus(s));
  assert.deepEqual(terminal, ["SUCCEEDED", "SUCCEEDED_WITH_LIMITS", "FAILED", "EXPIRED"]);
});

test("isPlaceHoldingJobStatus: only RUNNING holds a place; QUEUED and WAITING hold none (FR121)", () => {
  const holding = JOB_STATUSES.filter((s: JobStatus) => isPlaceHoldingJobStatus(s));
  assert.deepEqual(holding, ["RUNNING"]);
});

test("job type definitions: register, look up, and refuse a duplicate or an invalid bound", () => {
  const def: JobTypeDefinition = { type: "fixture-domain-a", host: "scraper", maxDurationMs: 60_000 };
  assert.equal(getJobTypeDefinition("fixture-domain-a"), undefined);
  registerJobTypeDefinition(def);
  assert.deepEqual(getJobTypeDefinition("fixture-domain-a"), def);
  assert.equal(getJobTypeDefinition("fixture-domain-unknown"), undefined);

  assert.throws(() => registerJobTypeDefinition(def), /already registered/);
  assert.throws(
    () => registerJobTypeDefinition({ type: "fixture-domain-b", host: "ai-processor", maxDurationMs: 0 }),
    /maxDurationMs/
  );
  assert.throws(
    () => registerJobTypeDefinition({ type: "fixture-domain-c", host: "ai-processor", maxDurationMs: Number.NaN }),
    /maxDurationMs/
  );
  assert.throws(
    () => registerJobTypeDefinition({ type: "", host: "scraper", maxDurationMs: 1 }),
    /type/
  );
});

test("computeJobDeadline: the whole-job bound is the admission time plus the type's maxDurationMs", () => {
  const admittedAt = new Date("2026-11-11T10:00:00.000Z");
  const def: JobTypeDefinition = { type: "x", host: "scraper", maxDurationMs: 90_000 };
  assert.equal(computeJobDeadline(admittedAt, def).toISOString(), "2026-11-11T10:01:30.000Z");
});

test("resolveAttemptBudgetMs: the smallest of the attempt cap, the time to the deadline and the Lambda's remaining time", () => {
  assert.equal(resolveAttemptBudgetMs({ attemptCapMs: 150_000, msToDeadline: 400_000 }), 150_000);
  assert.equal(resolveAttemptBudgetMs({ attemptCapMs: 150_000, msToDeadline: 40_000 }), 40_000);
  assert.equal(resolveAttemptBudgetMs({ attemptCapMs: 150_000, msToDeadline: 400_000, lambdaRemainingMs: 90_000 }), 90_000);
  // A deadline already passed leaves no budget (never negative).
  assert.equal(resolveAttemptBudgetMs({ attemptCapMs: 150_000, msToDeadline: -5, lambdaRemainingMs: 90_000 }), 0);
  // An undefined Lambda budget is ignored.
  assert.equal(resolveAttemptBudgetMs({ attemptCapMs: 10, msToDeadline: 20, lambdaRemainingMs: undefined }), 10);
});
