import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS,
  classifyProviderRun,
  evaluateProviderRunHealth,
  type ProviderRunHealthOptions,
  type ProviderRunSample,
} from "./evaluate-provider-run-health.js";

const base = new Date("2026-10-22T12:00:00.000Z");
// minutesAgo(0) is the newest; each helper builds one finished run completed that long before `base`.
const at = (minutesAgo: number) => new Date(base.getTime() - minutesAgo * 60_000);
const ok = (minutesAgo: number): ProviderRunSample => ({ status: "SUCCEEDED", itemCount: 4, completedAt: at(minutesAgo) });
const empty = (minutesAgo: number): ProviderRunSample => ({ status: "SUCCEEDED", itemCount: 0, completedAt: at(minutesAgo) });
const failed = (minutesAgo: number): ProviderRunSample => ({ status: "FAILED", itemCount: 0, completedAt: at(minutesAgo) });

/** `n` runs of one kind, completed one minute apart starting `from` minutes ago. */
const many = (make: (m: number) => ProviderRunSample, n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => make(from + i));

/** The evaluation as of `base`, so the fixtures stay inside the recency window whatever the real date. */
const evaluate = (runs: ProviderRunSample[], options?: ProviderRunHealthOptions) =>
  evaluateProviderRunHealth(runs, options, base);

test("classifyProviderRun: a success with posts is ok, with none is empty, with no recorded count is ok", () => {
  assert.equal(classifyProviderRun(ok(1)), "ok");
  assert.equal(classifyProviderRun(empty(1)), "empty");
  assert.equal(classifyProviderRun({ status: "SUCCEEDED", itemCount: null, completedAt: at(1) }), "ok");
});

test("classifyProviderRun: failed, timed out and aborted runs are failed", () => {
  for (const status of ["FAILED", "TIMED_OUT", "ABORTED"] as const) {
    assert.equal(classifyProviderRun({ status, itemCount: null, completedAt: at(1) }), "failed");
  }
});

test("classifyProviderRun: an unfinished run says nothing", () => {
  assert.equal(classifyProviderRun({ status: "PENDING", itemCount: null, completedAt: null }), null);
  assert.equal(classifyProviderRun({ status: "SUCCEEDED", itemCount: 3, completedAt: null }), null);
});

test("no runs at all is healthy", () => {
  const health = evaluate([]);
  assert.deepEqual(health, { degraded: false, reason: null, sampled: 0, ok: 0, empty: 0, failed: 0 });
});

test("no runs is healthy even if the minimum were zero", () => {
  const health = evaluateProviderRunHealth([], { ...DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, minRuns: 0 });
  assert.equal(health.degraded, false);
});

test("fewer finished runs than the minimum prove nothing, however bad they are", () => {
  const health = evaluate(many(failed, 9));
  assert.equal(health.degraded, false);
  assert.equal(health.sampled, 9);
});

test("a fleet that mostly fails is VENDOR_FAILURE", () => {
  const health = evaluate(many(failed, 16).concat(many(ok, 4, 16)));
  assert.deepEqual(health, { degraded: true, reason: "VENDOR_FAILURE", sampled: 20, ok: 4, empty: 0, failed: 16 });
});

test("exactly the failed-share threshold is already a failure", () => {
  // 16 of 20 is 80 %.
  assert.equal(evaluate(many(failed, 16).concat(many(ok, 4, 16))).reason, "VENDOR_FAILURE");
  // 15 of 20 is 75 %, below the threshold, and the sample still has posts in it.
  const health = evaluate(many(failed, 15).concat(many(ok, 5, 15)));
  assert.equal(health.degraded, false);
});

test("a whole sample of successes that returned nothing is ALL_EMPTY (the 2026-10-21 Bright Data day)", () => {
  const health = evaluate(many(empty, 38));
  assert.deepEqual(health, { degraded: true, reason: "ALL_EMPTY", sampled: 20, ok: 0, empty: 20, failed: 0 });
});

test("a mix of failures and empties with no post is ALL_EMPTY when failures alone are under the threshold", () => {
  const health = evaluate(many(failed, 5).concat(many(empty, 15, 5)));
  assert.equal(health.reason, "ALL_EMPTY");
});

test("a normal day, about half the runs empty, is healthy", () => {
  const runs = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? ok(i) : empty(i)));
  assert.equal(evaluate(runs).degraded, false);
});

test("one newest run that returned posts clears a degraded provider (the way back after a probe)", () => {
  const stillBadHistory = many(failed, 19, 1);
  assert.equal(evaluate([...stillBadHistory, failed(0)]).degraded, true);
  const health = evaluate([...stillBadHistory, ok(0)]);
  assert.equal(health.degraded, false);
  assert.equal(health.reason, null);
});

test("ordering comes from completedAt, not from the order the rows are passed in", () => {
  const shuffled = [ok(0), ...many(failed, 19, 1)].reverse();
  assert.equal(evaluate(shuffled).degraded, false);
});

test("only the newest sampleSize finished runs count; older runs and unfinished runs are ignored", () => {
  const oldGoodRuns = many(ok, 30, 100);
  const unfinished: ProviderRunSample = { status: "PENDING", itemCount: null, completedAt: null };
  const health = evaluate([...many(failed, 20), ...oldGoodRuns, unfinished]);
  assert.equal(health.sampled, 20);
  assert.equal(health.reason, "VENDOR_FAILURE");
});

test("thresholds can be overridden", () => {
  const options = { sampleSize: 4, minRuns: 2, failedShare: 0.5, maxAgeHours: 72 };
  assert.equal(evaluate([failed(0), ok(1)], options).degraded, true);
  assert.equal(evaluate([ok(0), failed(1)], options).degraded, false);
});

test("a newest run the vendor did not fail clears a VENDOR_FAILURE: an empty probe proves it is answering", () => {
  const stillBadHistory = many(failed, 19, 1);
  assert.equal(evaluate([...stillBadHistory, failed(0)]).reason, "VENDOR_FAILURE");

  const health = evaluate([...stillBadHistory, empty(0)]);
  assert.equal(health.degraded, false);
  assert.equal(health.reason, null);
});

test("a newest empty run does NOT clear ALL_EMPTY: an empty run is exactly what that state is made of", () => {
  const health = evaluate(many(empty, 20));
  assert.equal(health.degraded, true);
  assert.equal(health.reason, "ALL_EMPTY");
});

test("runs older than the recency window are ignored, so a flag with no fresh evidence expires", () => {
  const hoursAgo = (h: number): ProviderRunSample => ({ status: "FAILED", itemCount: 0, completedAt: new Date(base.getTime() - h * 3_600_000) });
  const stale = Array.from({ length: 20 }, () => hoursAgo(100));

  const health = evaluate(stale);

  assert.equal(health.sampled, 0);
  assert.equal(health.degraded, false);
});

test("only the runs inside the window count: stale good runs do not dilute fresh failures, stale failures do not condemn a fresh provider", () => {
  const hoursAgo = (kind: "ok" | "failed", h: number): ProviderRunSample => ({
    status: kind === "failed" ? "FAILED" : "SUCCEEDED",
    itemCount: kind === "failed" ? 0 : 3,
    completedAt: new Date(base.getTime() - h * 3_600_000),
  });
  const freshFailures = Array.from({ length: 12 }, (_, i) => hoursAgo("failed", 1 + i / 100));
  const staleGood = Array.from({ length: 20 }, () => hoursAgo("ok", 200));
  const degraded = evaluate([...freshFailures, ...staleGood]);
  assert.equal(degraded.sampled, 12);
  assert.equal(degraded.reason, "VENDOR_FAILURE");

  const staleFailures = Array.from({ length: 20 }, () => hoursAgo("failed", 200));
  const freshGood = Array.from({ length: 12 }, (_, i) => hoursAgo("ok", 1 + i / 100));
  const healthy = evaluate([...staleFailures, ...freshGood]);
  assert.equal(healthy.sampled, 12);
  assert.equal(healthy.degraded, false);
});

test("a run exactly at the edge of the window still counts; one a moment older does not", () => {
  const edge = (offsetMs: number): ProviderRunSample => ({
    status: "FAILED",
    itemCount: 0,
    completedAt: new Date(base.getTime() - 72 * 3_600_000 - offsetMs),
  });

  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(0))).sampled, 10);
  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(1))).sampled, 0);
});

test("the window is measured from the real clock when no time is passed", () => {
  const justNow = (): ProviderRunSample => ({ status: "FAILED", itemCount: 0, completedAt: new Date() });

  const health = evaluateProviderRunHealth(Array.from({ length: 10 }, justNow));

  assert.equal(health.sampled, 10);
  assert.equal(health.reason, "VENDOR_FAILURE");
});
