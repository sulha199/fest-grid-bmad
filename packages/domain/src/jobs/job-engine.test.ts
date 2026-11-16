import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_STATUSES,
  JOB_TERMINAL_STATUSES,
  JOB_TRIGGERS,
  computeJobDeadline,
  getJobTypeDefinition,
  listJobTypeDefinitions,
  isTerminalJobStatus,
  jobHasValidOwner,
  registerJobTypeDefinition,
  resolveAttemptBudgetMs,
  resolveAttemptCapMs,
  type Job,
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

test("job type definitions: the sharing and slot-reservation flags are optional and listed (Story 10.3)", () => {
  registerJobTypeDefinition({ type: "fixture-domain-flags-on", host: "scraper", maxDurationMs: 1, sharedAcrossUsers: true, reservesSubscriptionSlot: true });
  registerJobTypeDefinition({ type: "fixture-domain-flags-off", host: "scraper", maxDurationMs: 1 });
  assert.equal(getJobTypeDefinition("fixture-domain-flags-on")?.sharedAcrossUsers, true);
  assert.equal(getJobTypeDefinition("fixture-domain-flags-on")?.reservesSubscriptionSlot, true);
  assert.equal(getJobTypeDefinition("fixture-domain-flags-off")?.sharedAcrossUsers, undefined);
  const types = listJobTypeDefinitions().map((d) => d.type);
  assert.ok(types.includes("fixture-domain-flags-on") && types.includes("fixture-domain-flags-off"));
  assert.deepEqual(
    listJobTypeDefinitions().filter((d) => d.reservesSubscriptionSlot).map((d) => d.type).filter((t) => t.startsWith("fixture-domain-flags")),
    ["fixture-domain-flags-on"]
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

test('jobHasValidOwner: a USER job needs an owner, a SYSTEM job needs none (FR130, the rule the database CHECK also enforces)', () => {
  assert.equal(jobHasValidOwner({ trigger: 'USER', ownerUserId: 'u1' }), true);
  assert.equal(jobHasValidOwner({ trigger: 'USER', ownerUserId: undefined }), false);
  assert.equal(jobHasValidOwner({ trigger: 'USER', ownerUserId: '' }), false);
  assert.equal(jobHasValidOwner({ trigger: 'SYSTEM', ownerUserId: undefined }), true);
  assert.equal(jobHasValidOwner({ trigger: 'SYSTEM', ownerUserId: 'u1' }), true);
});

test('the Job type carries the product-visible shape of PRD 4.21', () => {
  const job: Job = {
    id: 'j1',
    type: 'fixture',
    trigger: 'USER',
    ownerUserId: 'u1',
    inputKey: 'k',
    status: 'WAITING',
    phase: 'waiting-retry',
    reasonCode: undefined,
    createdAt: '2026-11-11T00:00:00.000Z',
    finishedAt: undefined,
    deadlineAt: '2026-11-11T01:00:00.000Z',
    completedAfterDeadline: false,
  };
  assert.equal(job.status, 'WAITING');
});

test("a type may declare its own per-run cap (Story 10.6): it must be a positive number, and resolveAttemptCapMs prefers it over the default", () => {
  registerJobTypeDefinition({ type: "fixture-domain-cap-ok", host: "scraper", maxDurationMs: 1, attemptCapMs: 270_000 });
  assert.equal(getJobTypeDefinition("fixture-domain-cap-ok")?.attemptCapMs, 270_000);
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => registerJobTypeDefinition({ type: `fixture-domain-cap-bad-${String(bad)}`, host: "scraper", maxDurationMs: 1, attemptCapMs: bad }),
      /attemptCapMs must be a positive number/
    );
  }
  assert.equal(resolveAttemptCapMs(getJobTypeDefinition("fixture-domain-cap-ok"), 150_000), 270_000);
  assert.equal(resolveAttemptCapMs({}, 150_000), 150_000, "a type with no cap keeps the default");
  assert.equal(resolveAttemptCapMs(undefined, 150_000), 150_000, "an unknown type keeps the default");
});
