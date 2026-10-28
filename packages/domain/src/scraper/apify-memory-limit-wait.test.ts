import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APIFY_MEMORY_LIMIT_MAX_WAIT_MS,
  nextApifyMemoryLimitWaitMs,
  resolveApifyMemoryLimitMaxWaitMs,
} from "./apify-memory-limit-wait.js";

test("the wait budget is a fixed cap, but never more than half the call budget", () => {
  assert.equal(APIFY_MEMORY_LIMIT_MAX_WAIT_MS, 60_000);
  // The queue worker's default call budget (SCRAPE_QUEUE_APIFY_CALL_TIMEOUT_MS): the cap applies.
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(120_000), 60_000);
  // A smaller budget: half of it, so a run that does start still has the other half.
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(26_000), 13_000);
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(1_000), 500);
  // A larger one does not raise the cap.
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(600_000), 60_000);
});

test("a degenerate budget gives no wait at all", () => {
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(0), 0);
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(-5), 0);
  assert.equal(resolveApifyMemoryLimitMaxWaitMs(Number.NaN), 0);
});

test("the waits double from 5s, cap at 20s, and the last one is trimmed to what is left of the budget", () => {
  const maxWaitMs = 60_000;
  const waits: number[] = [];
  let waited = 0;
  for (let attempt = 0; ; attempt += 1) {
    const next = nextApifyMemoryLimitWaitMs({ attempt, elapsedMs: waited, maxWaitMs });
    if (next === null) break;
    waits.push(next);
    waited += next;
  }
  assert.deepEqual(waits, [5_000, 10_000, 20_000, 20_000, 5_000]);
  assert.equal(waited, maxWaitMs);
});

test("the total wait never exceeds the budget, whatever the attempt costs on its own", () => {
  for (const maxWaitMs of [0, 1, 499, 500, 13_000, 60_000]) {
    let elapsed = 0;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const next = nextApifyMemoryLimitWaitMs({ attempt, elapsedMs: elapsed, maxWaitMs });
      if (next === null) break;
      assert.ok(next > 0);
      elapsed += next;
      assert.ok(elapsed <= maxWaitMs, `budget ${maxWaitMs} exceeded: ${elapsed}`);
    }
  }
});

test("time spent on the failed attempts themselves counts against the budget", () => {
  // Three attempts took 58s between them (slow 402 round trips): only 2s of budget is left.
  assert.equal(nextApifyMemoryLimitWaitMs({ attempt: 3, elapsedMs: 58_000, maxWaitMs: 60_000 }), 2_000);
  // Once it is spent, there is no next wait.
  assert.equal(nextApifyMemoryLimitWaitMs({ attempt: 3, elapsedMs: 60_000, maxWaitMs: 60_000 }), null);
  assert.equal(nextApifyMemoryLimitWaitMs({ attempt: 3, elapsedMs: 75_000, maxWaitMs: 60_000 }), null);
});

test("a zero budget never waits", () => {
  assert.equal(nextApifyMemoryLimitWaitMs({ attempt: 0, elapsedMs: 0, maxWaitMs: 0 }), null);
});
