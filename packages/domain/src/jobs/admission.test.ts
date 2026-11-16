import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_STATUSES, type JobStatus } from "./job-engine.js";
import {
  compareQueueOrder,
  FOLLOWER_PHASE,
  decideAdmission,
  freePlaces,
  holdsPlace,
  queuePosition,
} from "./admission.js";

// Story 10.3 -- the pure admission rules (PRD 3.18 FR121): who holds a place, who is admitted, who waits and in what order.

const ADMITTED_AT = new Date("2026-11-11T10:00:00.000Z");

test("holdsPlace: an admitted QUEUED or RUNNING job holds a place; nothing else does (FR121)", () => {
  const holding = JOB_STATUSES.filter((status: JobStatus) => holdsPlace({ status, admittedAt: ADMITTED_AT }));
  assert.deepEqual(holding, ["QUEUED", "RUNNING"]);
});

test("holdsPlace: a QUEUED job that is not admitted waits and holds none", () => {
  assert.equal(holdsPlace({ status: "QUEUED", admittedAt: null }), false);
  assert.equal(holdsPlace({ status: "QUEUED", admittedAt: undefined }), false);
  assert.equal(holdsPlace({ status: "RUNNING", admittedAt: null }), false);
});

test("freePlaces: never negative, even when a user already holds more than the limit", () => {
  assert.equal(freePlaces({ placesHeld: 0, maxPlaces: 3 }), 3);
  assert.equal(freePlaces({ placesHeld: 2, maxPlaces: 3 }), 1);
  assert.equal(freePlaces({ placesHeld: 3, maxPlaces: 3 }), 0);
  assert.equal(freePlaces({ placesHeld: 5, maxPlaces: 3 }), 0);
});

test("decideAdmission: a free place and nobody waiting admits the job", () => {
  assert.deepEqual(decideAdmission({ placesHeld: 0, queued: 0, maxPlaces: 3, maxQueued: 10 }), { decision: "ADMIT" });
  assert.deepEqual(decideAdmission({ placesHeld: 2, queued: 0, maxPlaces: 3, maxQueued: 10 }), { decision: "ADMIT" });
});

test("decideAdmission: no free place queues the job behind those already waiting, with its position", () => {
  assert.deepEqual(decideAdmission({ placesHeld: 3, queued: 0, maxPlaces: 3, maxQueued: 10 }), {
    decision: "QUEUE",
    position: 1,
  });
  assert.deepEqual(decideAdmission({ placesHeld: 3, queued: 4, maxPlaces: 3, maxQueued: 10 }), {
    decision: "QUEUE",
    position: 5,
  });
});

test("decideAdmission: a free place does not let a newcomer jump the queue (oldest first)", () => {
  assert.deepEqual(decideAdmission({ placesHeld: 1, queued: 2, maxPlaces: 3, maxQueued: 10 }), {
    decision: "QUEUE",
    position: 3,
  });
});

test("decideAdmission: a full queue refuses, one short of full still queues", () => {
  assert.deepEqual(decideAdmission({ placesHeld: 3, queued: 10, maxPlaces: 3, maxQueued: 10 }), {
    decision: "REFUSE_QUEUE_FULL",
  });
  assert.deepEqual(decideAdmission({ placesHeld: 3, queued: 9, maxPlaces: 3, maxQueued: 10 }), {
    decision: "QUEUE",
    position: 10,
  });
});

test("compareQueueOrder: oldest queued_since first, then the smaller id", () => {
  const a = { id: "a", queuedSince: new Date("2026-11-11T10:00:00.000Z") };
  const b = { id: "b", queuedSince: new Date("2026-11-11T10:00:01.000Z") };
  const c = { id: "c", queuedSince: new Date("2026-11-11T10:00:00.000Z") };
  assert.ok(compareQueueOrder(a, b) < 0);
  assert.ok(compareQueueOrder(b, a) > 0);
  assert.ok(compareQueueOrder(a, c) < 0);
  assert.ok(compareQueueOrder(c, a) > 0);
  assert.equal(compareQueueOrder(a, a), 0);
});

test("queuePosition: one more than the jobs ahead of it in the queue", () => {
  const queued = [
    { id: "b", queuedSince: new Date("2026-11-11T10:00:01.000Z") },
    { id: "a", queuedSince: new Date("2026-11-11T10:00:00.000Z") },
    { id: "c", queuedSince: new Date("2026-11-11T10:00:02.000Z") },
  ];
  assert.equal(queuePosition("a", queued), 1);
  assert.equal(queuePosition("b", queued), 2);
  assert.equal(queuePosition("c", queued), 3);
});

test("queuePosition: a job that is not in the queue has no position", () => {
  assert.equal(queuePosition("missing", [{ id: "a", queuedSince: new Date("2026-11-11T10:00:00.000Z") }]), null);
});

test("FOLLOWER_PHASE is the marker the sweep uses to recognise a follower whose leader is gone", () => {
  assert.equal(FOLLOWER_PHASE, "following-leader");
});
