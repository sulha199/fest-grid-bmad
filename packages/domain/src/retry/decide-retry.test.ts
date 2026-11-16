import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_IN_CALL_ATTEMPTS,
  MAX_QUOTA_DEFERRAL_MS,
  RETRY_SITUATIONS,
  decideRetry,
  formatRetryDecisionLog,
} from "./decide-retry.js";

// random() = 0.5 means zero jitter: attempt 1 => 1000ms, 2 => 2000ms, 3 => 4000ms.
const noJitter = () => 0.5;

describe("decideRetry: rate_limited", () => {
  it("honors the server hint (rounded up to 43s) plus a 1s margin", () => {
    const d = decideRetry("rate_limited", 1, { retryAfterSeconds: 42.4, random: noJitter });
    assert.deepEqual([d.action, d.delayMs], ["retry_now", 44_000]);
  });

  it("falls back to jittered backoff with no hint", () => {
    const d = decideRetry("rate_limited", 2, { random: noJitter });
    assert.deepEqual([d.action, d.delayMs], ["retry_now", 2000]);
  });

  it("switches credential when another one exists", () => {
    const d = decideRetry("rate_limited", 1, { retryAfterSeconds: 42, hasAlternateCredential: true });
    assert.deepEqual([d.action, d.delayMs], ["switch_credential", 0]);
  });

  it("hands the retry to the durable layer when the delay does not fit the budget", () => {
    const d = decideRetry("rate_limited", 1, { retryAfterSeconds: 42, budgetMs: 30_000 });
    assert.equal(d.action, "retry_later");
    assert.equal(d.delayMs, 43_000);
  });

  it("hands over when the in-call attempts are spent", () => {
    const d = decideRetry("rate_limited", DEFAULT_MAX_IN_CALL_ATTEMPTS, { retryAfterSeconds: 1 });
    assert.equal(d.action, "retry_later");
  });
});

describe("decideRetry: quota_exhausted_daily", () => {
  it("waits for the reset, capped at one day", () => {
    const d = decideRetry("quota_exhausted_daily", 1, { msUntilQuotaReset: 3 * 60 * 60 * 1000 });
    assert.deepEqual([d.action, d.delayMs], ["retry_later", 3 * 60 * 60 * 1000]);
  });

  it("defaults to one day when the reset time is unknown", () => {
    const d = decideRetry("quota_exhausted_daily", 1);
    assert.deepEqual([d.action, d.delayMs], ["retry_later", MAX_QUOTA_DEFERRAL_MS]);
  });

  it("gives up when the reset is more than a day away", () => {
    assert.equal(decideRetry("quota_exhausted_daily", 1, { msUntilQuotaReset: MAX_QUOTA_DEFERRAL_MS + 1 }).action, "give_up");
  });

  it("never retries inside the call, whatever the budget", () => {
    assert.equal(decideRetry("quota_exhausted_daily", 1, { budgetMs: 10_000_000 }).action, "retry_later");
  });
});

describe("decideRetry: unavailable and timeout", () => {
  for (const situation of ["unavailable", "timeout"] as const) {
    it(`${situation}: jittered exponential backoff 1s, 2s while attempts and budget allow`, () => {
      assert.deepEqual(
        [1, 2].map((a) => decideRetry(situation, a, { random: noJitter }).delayMs),
        [1000, 2000]
      );
      assert.equal(decideRetry(situation, 1, { random: noJitter }).action, "retry_now");
    });

    it(`${situation}: retry_later once attempts are spent or the budget is too small`, () => {
      assert.equal(decideRetry(situation, 3, { random: noJitter }).action, "retry_later");
      assert.equal(decideRetry(situation, 1, { random: noJitter, budgetMs: 1500 }).action, "retry_later");
      assert.equal(decideRetry(situation, 1, { random: noJitter, budgetMs: 2000 }).action, "retry_now");
    });
  }

  it("the jitter stays within plus or minus 20%", () => {
    const low = decideRetry("unavailable", 1, { random: () => 0 }).delayMs!;
    const high = decideRetry("unavailable", 1, { random: () => 0.999999 }).delayMs!;
    assert.ok(low >= 800 && high <= 1200, `${low}..${high}`);
  });
});

describe("decideRetry: truncated", () => {
  it("splits the window, never repeating the same request", () => {
    assert.equal(decideRetry("truncated", 1).action, "split_window");
  });

  it("gives up at the smallest window", () => {
    assert.equal(decideRetry("truncated", 1, { windowIsSmallestUnit: true }).action, "give_up");
  });
});

describe("decideRetry: unparseable", () => {
  it("retries once at once, then later", () => {
    assert.deepEqual(
      [decideRetry("unparseable", 1).action, decideRetry("unparseable", 1).delayMs],
      ["retry_now", 0]
    );
    const second = decideRetry("unparseable", 2, { random: noJitter });
    assert.deepEqual([second.action, second.delayMs], ["retry_later", 2000]);
  });
});

describe("decideRetry: never retried", () => {
  it("blocked and bad_request give up at once", () => {
    assert.equal(decideRetry("blocked", 1).action, "give_up");
    assert.equal(decideRetry("bad_request", 1).action, "give_up");
  });
});

describe("decideRetry: invalid_credential", () => {
  it("switches when another credential exists, else gives up", () => {
    assert.equal(decideRetry("invalid_credential", 1, { hasAlternateCredential: true }).action, "switch_credential");
    assert.equal(decideRetry("invalid_credential", 1).action, "give_up");
  });
});

describe("decideRetry: image_expired and unknown", () => {
  it("image_expired asks for a re-scrape", () => {
    assert.equal(decideRetry("image_expired", 1).action, "rescrape");
  });

  it("unknown retries later once, then gives up", () => {
    assert.equal(decideRetry("unknown", 1, { random: noJitter }).action, "retry_later");
    assert.equal(decideRetry("unknown", 2).action, "give_up");
  });
});

describe("decideRetry: input guards", () => {
  it("ignores a non-numeric or negative retry hint", () => {
    for (const retryAfterSeconds of [NaN, Infinity, -5]) {
      const d = decideRetry("rate_limited", 1, { retryAfterSeconds, random: noJitter });
      assert.deepEqual([d.action, d.delayMs], ["retry_now", 1000], String(retryAfterSeconds));
    }
  });

  it("treats an attempt number below 1 as the first attempt", () => {
    for (const attempt of [0, -3, NaN]) {
      assert.equal(decideRetry("unavailable", attempt, { random: noJitter }).delayMs, 1000, String(attempt));
    }
  });

  it("needs minAttemptMs of budget left after the wait, so a long wait is not followed by a doomed attempt", () => {
    const hint = { retryAfterSeconds: 30, budgetMs: 40_000 };
    assert.equal(decideRetry("rate_limited", 1, hint).action, "retry_now");
    assert.equal(decideRetry("rate_limited", 1, { ...hint, minAttemptMs: 15_000 }).action, "retry_later");
    assert.equal(decideRetry("rate_limited", 1, { ...hint, minAttemptMs: 9_000 }).action, "retry_now");
  });
});

describe("decideRetry: coverage of the situation set", () => {
  it("answers every situation with an action and a reason", () => {
    for (const situation of RETRY_SITUATIONS) {
      const d = decideRetry(situation, 1, { random: noJitter });
      assert.ok(d.action && d.reason, situation);
    }
  });
});

describe("formatRetryDecisionLog", () => {
  it("is one greppable line", () => {
    const d = decideRetry("unavailable", 1, { random: noJitter });
    assert.equal(
      formatRetryDecisionLog("gemini:key:abc", "unavailable", 1, d),
      "[retry-decision] subject=gemini:key:abc situation=unavailable action=retry_now attempt=1 delayMs=1000"
    );
    const gone = decideRetry("blocked", 1);
    assert.equal(
      formatRetryDecisionLog("post:1", "blocked", 1, gone),
      "[retry-decision] subject=post:1 situation=blocked action=give_up attempt=1 delayMs=0"
    );
  });
});
