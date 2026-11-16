import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EXTRACTION_MAX_ATTEMPTS,
  EXTRACTION_RETRY_BACKOFF_MINUTES,
  EXTRACTION_RETRY_WINDOW_MS,
  planExtractionFailure,
} from "./extraction-retry.js";

const now = new Date("2026-11-09T10:00:00.000Z");
const minutes = (m: number) => m * 60 * 1000;
const noJitter = () => 0.5;

describe("planExtractionFailure", () => {
  it("first failure of a transient situation: attempt 1, retry after the first backoff", () => {
    const plan = planExtractionFailure({ situation: "unavailable", attemptsBefore: 0, firstFailureAt: null, now, hint: { random: noJitter } });
    assert.equal(plan.attempts, 1);
    assert.equal(plan.failureReason, "unavailable");
    assert.equal(plan.firstFailureAt.getTime(), now.getTime());
    assert.equal(plan.nextAttemptAt?.getTime(), now.getTime() + minutes(EXTRACTION_RETRY_BACKOFF_MINUTES[0]));
    assert.equal(plan.givenUpBecause, null);
  });

  it("the wait grows with the attempt and stays at the last step", () => {
    const first = new Date(now.getTime() - minutes(1));
    const waits = [1, 2, 3, 4].map((before) => {
      const plan = planExtractionFailure({ situation: "unavailable", attemptsBefore: before, firstFailureAt: first, now, hint: { random: noJitter } });
      return plan.nextAttemptAt ? plan.nextAttemptAt.getTime() - now.getTime() : null;
    });
    assert.deepEqual(waits, [minutes(15), minutes(60), minutes(240), null], "the fifth attempt is the last");
  });

  it("never waits less than the policy's own delay (a server hint longer than the backoff wins)", () => {
    const plan = planExtractionFailure({
      situation: "rate_limited",
      hint: { retryAfterSeconds: 3600, random: noJitter },
      attemptsBefore: 0,
      firstFailureAt: null,
      now,
    });
    assert.equal(plan.nextAttemptAt?.getTime(), now.getTime() + 3601 * 1000);
  });

  it("a per-day quota waits for the reset the policy gives, even past the first-failure window", () => {
    const plan = planExtractionFailure({ situation: "quota_exhausted_daily", attemptsBefore: 0, firstFailureAt: null, now });
    assert.equal(plan.nextAttemptAt?.getTime(), now.getTime() + EXTRACTION_RETRY_WINDOW_MS);
  });

  it("deterministic failures give up at once, with the reason kept", () => {
    for (const situation of ["blocked", "bad_request"] as const) {
      const plan = planExtractionFailure({ situation, attemptsBefore: 0, firstFailureAt: null, now });
      assert.equal(plan.nextAttemptAt, null, situation);
      assert.equal(plan.failureReason, situation);
      assert.ok(plan.givenUpBecause);
    }
  });

  it("actions a job retry cannot perform (split, re-scrape, switch) end the retries for this slice", () => {
    for (const situation of ["truncated", "image_expired", "invalid_credential"] as const) {
      assert.equal(planExtractionFailure({ situation, attemptsBefore: 0, firstFailureAt: null, now }).nextAttemptAt, null, situation);
    }
  });

  it("unparseable is retried; unknown once, then given up", () => {
    assert.ok(planExtractionFailure({ situation: "unparseable", attemptsBefore: 0, firstFailureAt: null, now, hint: { random: noJitter } }).nextAttemptAt);
    assert.ok(planExtractionFailure({ situation: "unknown", attemptsBefore: 0, firstFailureAt: null, now, hint: { random: noJitter } }).nextAttemptAt);
    assert.equal(planExtractionFailure({ situation: "unknown", attemptsBefore: 1, firstFailureAt: now, now }).nextAttemptAt, null);
  });

  it("gives up when the attempts are spent", () => {
    const plan = planExtractionFailure({
      situation: "unavailable",
      attemptsBefore: EXTRACTION_MAX_ATTEMPTS - 1,
      firstFailureAt: now,
      now,
    });
    assert.equal(plan.attempts, EXTRACTION_MAX_ATTEMPTS);
    assert.equal(plan.nextAttemptAt, null);
    assert.match(plan.givenUpBecause ?? "", /attempts spent/);
  });

  it("gives up when the next attempt would fall outside the 24 hour window from the first failure", () => {
    const first = new Date(now.getTime() - EXTRACTION_RETRY_WINDOW_MS + minutes(10));
    const plan = planExtractionFailure({ situation: "unavailable", attemptsBefore: 1, firstFailureAt: first, now, hint: { random: noJitter } });
    assert.equal(plan.nextAttemptAt, null);
    assert.match(plan.givenUpBecause ?? "", /window/);
    assert.equal(plan.firstFailureAt.getTime(), first.getTime(), "the first failure time is kept");
  });

  it("a first retry hinted beyond the 24 hour window is not scheduled", () => {
    const plan = planExtractionFailure({
      situation: "rate_limited",
      hint: { retryAfterSeconds: 3 * 24 * 3600, random: noJitter },
      attemptsBefore: 0,
      firstFailureAt: null,
      now,
    });
    assert.equal(plan.nextAttemptAt, null);
    assert.match(plan.givenUpBecause ?? "", /window/);
  });

  it("a per-day quota is retried even on a later attempt, past the first-failure window", () => {
    const first = new Date(now.getTime() - minutes(60));
    const plan = planExtractionFailure({ situation: "quota_exhausted_daily", attemptsBefore: 1, firstFailureAt: first, now });
    assert.equal(plan.attempts, 2);
    assert.equal(plan.nextAttemptAt?.getTime(), now.getTime() + EXTRACTION_RETRY_WINDOW_MS);
  });

  it("a negative attempts counter is treated as zero", () => {
    assert.equal(planExtractionFailure({ situation: "unavailable", attemptsBefore: -4, firstFailureAt: null, now }).attempts, 1);
  });
});
