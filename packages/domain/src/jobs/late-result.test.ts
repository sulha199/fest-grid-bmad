import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_STATUSES, type JobStatus } from "./job-engine.js";
import { canSettleFromLateResult, decideSnapshotWait, isCompletedAfterDeadline } from "./late-result.js";

// Story 10.5 -- the pure rules of a late vendor result (PRD 3.18 FR119): when a snapshot is collected, given up on or waited for,
// and which job endings a late result may settle.

const MAX = 480 * 60_000;

test("decideSnapshotWait: a ready snapshot is collected whatever its age, a failed one is given up on", () => {
  assert.equal(decideSnapshotWait({ progressStatus: "ready", ageMs: 0, maxWaitMs: MAX }), "COLLECT");
  assert.equal(decideSnapshotWait({ progressStatus: "ready", ageMs: MAX * 10, maxWaitMs: MAX }), "COLLECT", "the bound never delays a ready snapshot");
  assert.equal(decideSnapshotWait({ progressStatus: "failed", ageMs: 0, maxWaitMs: MAX }), "GIVE_UP_FAILED");
  assert.equal(decideSnapshotWait({ progressStatus: "failed", ageMs: MAX * 10, maxWaitMs: MAX }), "GIVE_UP_FAILED");
});

test("decideSnapshotWait: a snapshot still in flight waits under the bound and is given up on at it", () => {
  for (const progressStatus of ["scheduled", "starting", "building", "running"] as const) {
    assert.equal(decideSnapshotWait({ progressStatus, ageMs: 0, maxWaitMs: MAX }), "WAIT", progressStatus);
    assert.equal(decideSnapshotWait({ progressStatus, ageMs: MAX - 1, maxWaitMs: MAX }), "WAIT", `${progressStatus} just under`);
    assert.equal(decideSnapshotWait({ progressStatus, ageMs: MAX, maxWaitMs: MAX }), "GIVE_UP_TOO_LONG", `${progressStatus} at the bound`);
    assert.equal(decideSnapshotWait({ progressStatus, ageMs: MAX + 1, maxWaitMs: MAX }), "GIVE_UP_TOO_LONG", `${progressStatus} past it`);
  }
});

test("decideSnapshotWait: a negative age (clock skew) still waits", () => {
  assert.equal(decideSnapshotWait({ progressStatus: "running", ageMs: -5_000, maxWaitMs: MAX }), "WAIT");
});

test("canSettleFromLateResult: only WAITING, RUNNING, QUEUED and EXPIRED with TIMED_OUT may be settled", () => {
  const settleable = JOB_STATUSES.filter((status: JobStatus) => canSettleFromLateResult({ status, reasonCode: null }));
  assert.deepEqual(settleable, ["QUEUED", "RUNNING", "WAITING"]);
  assert.equal(canSettleFromLateResult({ status: "EXPIRED", reasonCode: "TIMED_OUT" }), true);
});

test("canSettleFromLateResult: an expired job is revived only when it ran out of time, never for another reason or ending", () => {
  assert.equal(canSettleFromLateResult({ status: "EXPIRED", reasonCode: "WAITED_TOO_LONG" }), false);
  assert.equal(canSettleFromLateResult({ status: "EXPIRED", reasonCode: null }), false);
  assert.equal(canSettleFromLateResult({ status: "FAILED", reasonCode: "TIMED_OUT" }), false);
  assert.equal(canSettleFromLateResult({ status: "FAILED", reasonCode: "CANCELLED" }), false);
  assert.equal(canSettleFromLateResult({ status: "SUCCEEDED", reasonCode: null }), false);
  assert.equal(canSettleFromLateResult({ status: "SUCCEEDED_WITH_LIMITS", reasonCode: "X" }), false);
});

test("isCompletedAfterDeadline: strictly later than the deadline", () => {
  const deadline = new Date("2026-11-11T10:00:00.000Z");
  assert.equal(isCompletedAfterDeadline(deadline, new Date("2026-11-11T10:00:00.001Z")), true);
  assert.equal(isCompletedAfterDeadline(deadline, new Date("2026-11-11T10:00:00.000Z")), false);
  assert.equal(isCompletedAfterDeadline(deadline, new Date("2026-11-11T09:59:59.999Z")), false);
});
