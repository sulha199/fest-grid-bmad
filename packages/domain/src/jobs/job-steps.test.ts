import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_STATUSES } from "./job-engine.js";
import { deriveJobSteps } from "./job-steps.js";
import { getJobTypePresentation } from "./job-presentation.js";
import { REEXTRACT_POST_JOB_TYPE } from "./reextract-post.js";

// Story 10.4 (Part A) -- steps from the phase list and the job's phase, for every status.

const presentation = getJobTypePresentation(REEXTRACT_POST_JOB_TYPE);
const facts = { refreshOutcome: "REFRESHED" };
const states = (steps: ReturnType<typeof deriveJobSteps>) => steps.map((s) => `${s.key}:${s.state}`);

test("a QUEUED job has started nothing: every step PENDING", () => {
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "QUEUED", phase: null, hasStarted: false, facts })), ["refresh:PENDING", "preview:PENDING"]);
});

test("a RUNNING job: steps before its phase DONE, its phase CURRENT, the rest PENDING", () => {
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "RUNNING", phase: "refresh", hasStarted: true, facts })), ["refresh:CURRENT", "preview:PENDING"]);
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "RUNNING", phase: "preview", hasStarted: true, facts })), ["refresh:DONE", "preview:CURRENT"]);
});

test("a RUNNING or WAITING job with no phase yet (or an unknown one) is at its first step", () => {
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "RUNNING", phase: null, hasStarted: true, facts })), ["refresh:CURRENT", "preview:PENDING"]);
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "WAITING", phase: "no-such-phase", hasStarted: true, facts })), ["refresh:CURRENT", "preview:PENDING"]);
});

test("a skipped step is SKIPPED, and the first step that is not skipped is the current one", () => {
  const skip = { refreshOutcome: "NOT_NEEDED" };
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "RUNNING", phase: null, hasStarted: true, facts: skip })), ["refresh:SKIPPED", "preview:CURRENT"]);
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "SUCCEEDED", phase: "preview", hasStarted: true, facts: skip })), ["refresh:SKIPPED", "preview:DONE"]);
  assert.deepEqual(states(deriveJobSteps({ presentation, status: "QUEUED", phase: null, hasStarted: false, facts: skip })), ["refresh:SKIPPED", "preview:PENDING"]);
});

test("a SUCCEEDED or SUCCEEDED_WITH_LIMITS job shows every step DONE", () => {
  for (const status of ["SUCCEEDED", "SUCCEEDED_WITH_LIMITS"] as const) {
    assert.deepEqual(states(deriveJobSteps({ presentation, status, phase: "preview", hasStarted: true, facts })), ["refresh:DONE", "preview:DONE"]);
  }
});

test("a job that ended unhappily keeps its stopped step CURRENT; one that never started shows all PENDING", () => {
  for (const status of ["FAILED", "EXPIRED"] as const) {
    assert.deepEqual(states(deriveJobSteps({ presentation, status, phase: "preview", hasStarted: true, facts })), ["refresh:DONE", "preview:CURRENT"]);
    assert.deepEqual(states(deriveJobSteps({ presentation, status, phase: null, hasStarted: true, facts })), ["refresh:CURRENT", "preview:PENDING"]);
    assert.deepEqual(states(deriveJobSteps({ presentation, status, phase: null, hasStarted: false, facts })), ["refresh:PENDING", "preview:PENDING"]);
  }
});

test("a type with no phases has no steps in any status; counts are null", () => {
  const none = getJobTypePresentation("no-such-type");
  for (const status of JOB_STATUSES) {
    assert.deepEqual(deriveJobSteps({ presentation: none, status, phase: null, hasStarted: true, facts }), []);
  }
  const [first] = deriveJobSteps({ presentation, status: "RUNNING", phase: "refresh", hasStarted: true, facts });
  assert.equal(first.done, null);
  assert.equal(first.total, null);
});
