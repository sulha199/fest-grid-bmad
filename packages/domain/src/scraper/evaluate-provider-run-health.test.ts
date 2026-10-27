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
  const options = { sampleSize: 4, minRuns: 2, failedShare: 0.5, maxAgeHours: 72, carryOverMaxAgeHours: 72 };
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

test("runs older than the carry-over cap are ignored, so a flag with no evidence at all expires", () => {
  const hoursAgo = (h: number): ProviderRunSample => ({ status: "FAILED", itemCount: 0, completedAt: new Date(base.getTime() - h * 3_600_000) });
  const stale = Array.from({ length: 20 }, () => hoursAgo(14 * 24 + 1));

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

test("a run exactly at the edge of the carry-over cap still counts; one a moment older does not", () => {
  const edge = (offsetMs: number): ProviderRunSample => ({
    status: "FAILED",
    itemCount: 0,
    completedAt: new Date(base.getTime() - 14 * 24 * 3_600_000 - offsetMs),
  });

  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(0))).reason, "VENDOR_FAILURE");
  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(1))).sampled, 0);
});

test("a run exactly at the edge of the fresh window counts as fresh; one a moment older is judged by the carry-over", () => {
  const edge = (offsetMs: number): ProviderRunSample => ({
    status: "FAILED",
    itemCount: 0,
    completedAt: new Date(base.getTime() - 72 * 3_600_000 - offsetMs),
  });
  const noCarryOver = { ...DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, carryOverMaxAgeHours: 72 };

  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(0)), noCarryOver).sampled, 10);
  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(1)), noCarryOver).sampled, 0);
  assert.equal(evaluate(Array.from({ length: 10 }, () => edge(1))).reason, "VENDOR_FAILURE");
});

test("the window is measured from the real clock when no time is passed", () => {
  const justNow = (): ProviderRunSample => ({ status: "FAILED", itemCount: 0, completedAt: new Date() });

  const health = evaluateProviderRunHealth(Array.from({ length: 10 }, justNow));

  assert.equal(health.sampled, 10);
  assert.equal(health.reason, "VENDOR_FAILURE");
});

// ---------------------------------------------------------------------------------------------------
// The 2026-10-21 to 10-26 Bright Data outage, day by day. A degraded provider gets about 3 probe runs a
// day, so the fresh 72 hour window drops below minRuns and used to flip back to "healthy" while the
// vendor was still down; the next daily batch then sent all 38 targets to it and all 38 failed.
// ---------------------------------------------------------------------------------------------------

const utc = (iso: string) => new Date(`${iso}Z`);
/** `n` runs of one kind finished at `iso`, a minute apart. */
const batch = (kind: "ok" | "empty" | "failed", n: number, iso: string): ProviderRunSample[] =>
  Array.from({ length: n }, (_, i) => ({
    status: kind === "failed" ? "FAILED" : "SUCCEEDED",
    itemCount: kind === "ok" ? 4 : 0,
    completedAt: new Date(utc(iso).getTime() + i * 60_000),
  }));

/** The runs recorded up to 2026-10-26 03:13 UTC, as read from prod. */
const outageRunsBeforeThe26thBatch = (): ProviderRunSample[] => [
  ...batch("empty", 38, "2026-10-21T03:13:00"), // 0 records back, recorded as successes
  ...batch("failed", 6, "2026-10-23T09:00:00"), // manual runs
  ...batch("failed", 3, "2026-10-25T03:13:00"), // the batch's 3 probes
];
const batchTime26 = utc("2026-10-26T03:13:00");

test("2026-10-26 03:13: the 72 hour window holds 9 runs, which used to read as healthy", () => {
  const runs = outageRunsBeforeThe26thBatch();
  const withoutCarryOver = { ...DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, carryOverMaxAgeHours: DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS.maxAgeHours };

  const before = evaluateProviderRunHealth(runs, withoutCarryOver, batchTime26);
  assert.equal(before.sampled, 9);
  assert.equal(before.degraded, false);

  const after = evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, batchTime26);
  assert.equal(after.degraded, true);
  assert.equal(after.reason, "ALL_EMPTY");
  assert.equal(after.sampled, 20);
});

test("the same night with the earlier runs also failed is VENDOR_FAILURE", () => {
  const runs = [
    ...batch("failed", 38, "2026-10-21T03:13:00"),
    ...batch("failed", 6, "2026-10-23T09:00:00"),
    ...batch("failed", 3, "2026-10-25T03:13:00"),
  ];
  const health = evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, batchTime26);
  assert.equal(health.reason, "VENDOR_FAILURE");
});

test("day by day: with 3 failed probes a day (and a day with no run at all) the provider is degraded at every daily batch", () => {
  let runs = batch("empty", 38, "2026-10-21T03:13:00");
  const verdicts: boolean[] = [];

  for (const day of ["22", "23", "24", "25", "26", "27", "28", "29", "30", "31"]) {
    const now = utc(`2026-10-${day}T03:13:00`);
    const health = evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, now);
    verdicts.push(health.degraded);
    // A degraded provider gets only its probes; the 24th is a skipped day (no targets after a manual run).
    if (health.degraded && day !== "24") {
      runs = [...runs, ...batch("failed", 3, now.toISOString().slice(0, 19))];
    }
  }

  assert.deepEqual(verdicts, Array(10).fill(true));
});

test("a probe that returns posts clears the degradation at once, however old the failures", () => {
  const runs = [...outageRunsBeforeThe26thBatch(), ...batch("ok", 1, "2026-10-26T03:20:00")];
  const health = evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, utc("2026-10-26T03:30:00"));
  assert.equal(health.degraded, false);
  assert.equal(health.reason, null);
});

test("a probe that finds a quiet account clears VENDOR_FAILURE but not ALL_EMPTY, also through the carry-over", () => {
  const failedOutage = [...batch("failed", 38, "2026-10-21T03:13:00"), ...batch("failed", 9, "2026-10-25T03:13:00")];
  const now = utc("2026-10-26T03:30:00");
  const quietProbe = batch("empty", 1, "2026-10-26T03:20:00");
  assert.equal(evaluateProviderRunHealth([...failedOutage, ...quietProbe], DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, now).degraded, false);

  const emptyOutage = [...batch("empty", 38, "2026-10-21T03:13:00"), ...batch("empty", 9, "2026-10-25T03:13:00")];
  assert.equal(evaluateProviderRunHealth([...emptyOutage, ...quietProbe], DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, now).reason, "ALL_EMPTY");
});

test("recovery: after a probe returned posts and the batch followed, ordinary runs keep the provider healthy", () => {
  const runs = [
    ...outageRunsBeforeThe26thBatch(),
    ...batch("ok", 1, "2026-10-26T03:13:30"),
    ...batch("ok", 18, "2026-10-26T03:20:00"),
    ...batch("empty", 19, "2026-10-26T03:40:00"),
  ];
  const health = evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, utc("2026-10-27T03:13:00"));
  assert.equal(health.degraded, false);
});

test("the age cap: a provider nobody probed for more than 14 days is trusted again", () => {
  const runs = outageRunsBeforeThe26thBatch();
  // The 10-21 batch ran 03:13 to 03:50. While any of it is inside 14 days the sample still reaches 20 runs.
  assert.equal(evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, utc("2026-11-04T03:00:00")).degraded, true);
  // Once all of it has aged out only 9 runs are left, below minRuns.
  assert.equal(evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, utc("2026-11-05T04:00:00")).degraded, false);
});

test("a healthy provider with few runs is still healthy", () => {
  // 5 fresh successes and a failure: nothing to carry over.
  assert.equal(evaluate([...many(ok, 5), failed(6)]).degraded, false);
  // 3 failed runs and nothing else, however recent: not enough evidence either way.
  assert.equal(evaluate(many(failed, 3)).degraded, false);
  // 9 failed runs spread over 9 days: under minRuns even with the carry-over.
  const spread = Array.from({ length: 9 }, (_, i) => failed(i * 24 * 60));
  assert.equal(evaluate(spread).degraded, false);
});

test("a rarely used provider whose older runs were fine is not condemned by a few fresh failures", () => {
  const hoursAgo = (kind: "ok" | "failed", h: number): ProviderRunSample => ({
    status: kind === "failed" ? "FAILED" : "SUCCEEDED",
    itemCount: kind === "failed" ? 0 : 3,
    completedAt: new Date(base.getTime() - h * 3_600_000),
  });
  const runs = [
    ...Array.from({ length: 4 }, (_, i) => hoursAgo("failed", 1 + i)),
    ...Array.from({ length: 12 }, (_, i) => hoursAgo("ok", 100 + i)),
  ];
  const health = evaluate(runs);
  assert.equal(health.degraded, false);
  assert.equal(health.sampled, 4);
});

test("with the carry-over disabled the behaviour is the plain fresh-window one", () => {
  const options = { ...DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, carryOverMaxAgeHours: 0 };
  const stale = Array.from({ length: 12 }, (_, i) => failed(100 * 60 + i));
  assert.equal(evaluate(stale, options).degraded, false);
});
