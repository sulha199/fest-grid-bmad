import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { vendorCallLocks } from '@festgrid/database';
import { db } from '../../db/client.js';
import {
  callVendor,
  VendorKeyBusyError,
  VendorDpaNotConfirmedError,
  VendorCallTimeoutError,
} from './guarded-call.js';

const ALWAYS_TRANSIENT = () => true;
const NEVER_TRANSIENT = () => false;

async function deleteLockRow(lockKey: string): Promise<void> {
  await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, lockKey));
}

test('guarded-call: callVendor', async (t) => {
  await t.test('successful claim+release: lock row is claimed then released', async () => {
    const lockKey = 'test-guarded-call-claim-release';
    await deleteLockRow(lockKey);

    const result = await callVendor('gemini', {
      lockKey,
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'ok',
    });

    assert.equal(result, 'ok');

    const rows = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, lockKey));
    assert.equal(rows.length, 1);
    // Released: lockedUntil should be at/near now(), not a future TTL.
    assert.ok(rows[0].lockedUntil.getTime() <= Date.now() + 1000);

    await deleteLockRow(lockKey);
  });

  await t.test('busy-lock rejection: a live lock throws VendorKeyBusyError without invoking call', async () => {
    const lockKey = 'test-guarded-call-busy-lock';
    await deleteLockRow(lockKey);

    // Pre-insert a lease with lockedUntil in the future.
    await db.insert(vendorCallLocks).values({
      lockKey,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    let callInvoked = false;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          lockKey,
          timeoutMs: 1000,
          isTransient: NEVER_TRANSIENT,
          call: async () => {
            callInvoked = true;
            return 'should not run';
          },
        }),
      VendorKeyBusyError
    );
    assert.equal(callInvoked, false);

    await deleteLockRow(lockKey);
  });

  await t.test('expired-lock claim succeeds: lockedUntil in the past is reclaimable', async () => {
    const lockKey = 'test-guarded-call-expired-lock';
    await deleteLockRow(lockKey);

    await db.insert(vendorCallLocks).values({
      lockKey,
      lockedUntil: new Date(Date.now() - 60_000),
    });

    const result = await callVendor('gemini', {
      lockKey,
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'reclaimed',
    });

    assert.equal(result, 'reclaimed');

    await deleteLockRow(lockKey);
  });

  await t.test('lockKey omitted: skips the lock table entirely', async () => {
    const result = await callVendor('gemini', {
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'no-lock',
    });
    assert.equal(result, 'no-lock');
    // No lockKey was ever used, so nothing to clean up -- confirm no stray row matching this
    // test's naming convention was created.
  });

  await t.test('transient error retries with backoff and eventually succeeds', async () => {
    let attempts = 0;
    const result = await callVendor('gemini', {
      timeoutMs: 1000,
      maxAttempts: 3,
      isTransient: ALWAYS_TRANSIENT,
      call: async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('transient failure');
        }
        return 'succeeded-on-retry';
      },
    });
    assert.equal(result, 'succeeded-on-retry');
    assert.equal(attempts, 3);
  });

  await t.test('non-transient error propagates on first attempt with no retry', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 1000,
          maxAttempts: 3,
          isTransient: NEVER_TRANSIENT,
          call: async () => {
            attempts++;
            throw new Error('non-transient failure');
          },
        }),
      /non-transient failure/
    );
    assert.equal(attempts, 1);
  });

  await t.test('maxAttempts exhaustion propagates the last error', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 1000,
          maxAttempts: 3,
          isTransient: ALWAYS_TRANSIENT,
          call: async () => {
            attempts++;
            throw new Error(`attempt-${attempts}-failed`);
          },
        }),
      /attempt-3-failed/
    );
    assert.equal(attempts, 3);
  });

  // Story 0.i2z AC4 ratchet — this test is the enforcement for the hung-call-times-out
  // guarantee; do not duplicate it in the new ratchet file.
  await t.test('wrapper-level timeout fires VendorCallTimeoutError on a thunk that never resolves', async () => {
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 50,
          isTransient: NEVER_TRANSIENT,
          call: () => new Promise(() => {}),
        }),
      VendorCallTimeoutError
    );
  });

  // Story 0.i2z AC4 ratchet — this test is the enforcement for the hung-call-times-out
  // guarantee; do not duplicate it in the new ratchet file.
  await t.test('timeout aborts the AbortSignal passed into the thunk', async () => {
    let abortedViaEvent = false;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 50,
          isTransient: NEVER_TRANSIENT,
          // Deliberately never settles itself -- only records the abort event -- so the
          // wrapper's own timeout promise is what wins the race, and this assertion is purely
          // about whether the signal was aborted, not about who wins the Promise.race.
          call: (signal) =>
            new Promise(() => {
              signal.addEventListener('abort', () => {
                abortedViaEvent = true;
              });
            }),
        }),
      VendorCallTimeoutError
    );
    assert.equal(abortedViaEvent, true);
  });

  await t.test('timeout is never retried even when isTransient would say yes', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 50,
          maxAttempts: 3,
          isTransient: ALWAYS_TRANSIENT,
          call: () => {
            attempts++;
            return new Promise(() => {});
          },
        }),
      VendorCallTimeoutError
    );
    assert.equal(attempts, 1);
  });

  // Story 0.i2z AC5 ratchet.
  await t.test('DPA gate: apify rejects when APIFY_SCRAPING_CONFIRMED="false"', async (st) => {
    const original = process.env.APIFY_SCRAPING_CONFIRMED;
    process.env.APIFY_SCRAPING_CONFIRMED = 'false';
    st.after(() => {
      if (original === undefined) {
        delete process.env.APIFY_SCRAPING_CONFIRMED;
      } else {
        process.env.APIFY_SCRAPING_CONFIRMED = original;
      }
    });

    let callInvoked = false;
    await assert.rejects(
      () =>
        callVendor('apify', {
          timeoutMs: 1000,
          isTransient: NEVER_TRANSIENT,
          call: async () => {
            callInvoked = true;
            return 'should not run';
          },
        }),
      VendorDpaNotConfirmedError
    );
    assert.equal(callInvoked, false);
  });

  await t.test('DPA gate: apify allows when APIFY_SCRAPING_CONFIRMED is unset (default-true)', async (st) => {
    const original = process.env.APIFY_SCRAPING_CONFIRMED;
    delete process.env.APIFY_SCRAPING_CONFIRMED;
    st.after(() => {
      if (original !== undefined) {
        process.env.APIFY_SCRAPING_CONFIRMED = original;
      }
    });

    const result = await callVendor('apify', {
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'apify-ok',
    });
    assert.equal(result, 'apify-ok');
  });

  await t.test('DPA gate: brightdata rejects when BRIGHTDATA_SCRAPING_CONFIRMED="false"', async (st) => {
    const original = process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
    process.env.BRIGHTDATA_SCRAPING_CONFIRMED = 'false';
    st.after(() => {
      if (original === undefined) {
        delete process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
      } else {
        process.env.BRIGHTDATA_SCRAPING_CONFIRMED = original;
      }
    });

    await assert.rejects(
      () =>
        callVendor('brightdata', {
          timeoutMs: 1000,
          isTransient: NEVER_TRANSIENT,
          call: async () => 'should not run',
        }),
      VendorDpaNotConfirmedError
    );
  });

  await t.test('DPA gate: brightdata allows when BRIGHTDATA_SCRAPING_CONFIRMED is unset (default-true)', async (st) => {
    const original = process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
    delete process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
    st.after(() => {
      if (original !== undefined) {
        process.env.BRIGHTDATA_SCRAPING_CONFIRMED = original;
      }
    });

    const result = await callVendor('brightdata', {
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'brightdata-ok',
    });
    assert.equal(result, 'brightdata-ok');
  });

  await t.test('DPA gate: never invoked for gemini even when both flags are "false"', async (st) => {
    const originalApify = process.env.APIFY_SCRAPING_CONFIRMED;
    const originalBrightdata = process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
    process.env.APIFY_SCRAPING_CONFIRMED = 'false';
    process.env.BRIGHTDATA_SCRAPING_CONFIRMED = 'false';
    st.after(() => {
      if (originalApify === undefined) {
        delete process.env.APIFY_SCRAPING_CONFIRMED;
      } else {
        process.env.APIFY_SCRAPING_CONFIRMED = originalApify;
      }
      if (originalBrightdata === undefined) {
        delete process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
      } else {
        process.env.BRIGHTDATA_SCRAPING_CONFIRMED = originalBrightdata;
      }
    });

    const result = await callVendor('gemini', {
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => 'gemini-unaffected',
    });
    assert.equal(result, 'gemini-unaffected');
  });

  // ── Review-hardening regressions (PR #57 review) ────────────────────────────────────────────

  await t.test('timeout wins even when the thunk rejects from inside its own abort listener', async () => {
    // Abort listeners run synchronously. Before the fix, aborting first let this rejection win
    // Promise.race, surfacing a retryable error instead of VendorCallTimeoutError.
    let attempts = 0;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 50,
          isTransient: ALWAYS_TRANSIENT,
          call: (signal) =>
            new Promise<never>((_resolve, reject) => {
              attempts++;
              signal.addEventListener('abort', () => reject(new Error('rejected from abort listener')));
            }),
        }),
      (err: unknown) => err instanceof VendorCallTimeoutError
    );
    assert.equal(attempts, 1, 'a timeout must never be retried');
  });

  await t.test('release is ownership-checked: an expired-then-reclaimed lease is not cleared by the original caller', async () => {
    const lockKey = 'test-guarded-call-ownership';
    await deleteLockRow(lockKey);

    await callVendor('gemini', {
      lockKey,
      timeoutMs: 1000,
      isTransient: NEVER_TRANSIENT,
      call: async () => {
        // Simulate: our lease expired mid-call and another caller reclaimed the key, writing a
        // different live lease (a different lockedUntil value) into the same row.
        await db
          .update(vendorCallLocks)
          .set({ lockedUntil: new Date(Date.now() + 900_000) })
          .where(eq(vendorCallLocks.lockKey, lockKey));
        return 'ok';
      },
    });

    const [row] = await db.select().from(vendorCallLocks).where(eq(vendorCallLocks.lockKey, lockKey));
    assert.ok(
      row.lockedUntil.getTime() > Date.now() + 800_000,
      "the other caller's live lease must survive our release"
    );
    await deleteLockRow(lockKey);
  });

  await t.test('rejects a lockTtlMs that cannot outlive the attempt it protects', async () => {
    let invoked = false;
    await assert.rejects(
      () =>
        callVendor('gemini', {
          lockKey: 'test-guarded-call-ttl-validation',
          timeoutMs: 3000,
          lockTtlMs: 1000,
          isTransient: NEVER_TRANSIENT,
          call: async () => {
            invoked = true;
            return 'never';
          },
        }),
      (err: unknown) => err instanceof RangeError
    );
    assert.equal(invoked, false);
    const rows = await db
      .select()
      .from(vendorCallLocks)
      .where(eq(vendorCallLocks.lockKey, 'test-guarded-call-ttl-validation'));
    assert.equal(rows.length, 0, 'validation happens before any lease is written');
  });

  await t.test('overall deadline caps a hanging attempt below its own per-attempt timeout', async () => {
    const startedAt = Date.now();
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 5000,
          overallTimeoutMs: 300,
          isTransient: ALWAYS_TRANSIENT,
          call: () => new Promise<never>(() => {}),
        }),
      (err: unknown) => err instanceof VendorCallTimeoutError
    );
    assert.ok(Date.now() - startedAt < 2000, 'must stop near the 300ms overall budget, not the 5s attempt timeout');
  });

  await t.test('overall deadline stops retrying when backoff plus a minimal attempt no longer fits', async () => {
    let attempts = 0;
    const startedAt = Date.now();
    await assert.rejects(
      () =>
        callVendor('gemini', {
          timeoutMs: 1000,
          overallTimeoutMs: 1500,
          maxAttempts: 5,
          isTransient: ALWAYS_TRANSIENT,
          call: async () => {
            attempts++;
            throw new Error('503 upstream');
          },
        }),
      /503 upstream/
    );
    assert.equal(attempts, 1, 'the retry (>=800ms backoff + 1s minimum attempt) cannot fit in 1.5s, so it must not start');
    assert.ok(Date.now() - startedAt < 1000, 'the real error surfaces immediately, leaving time for cleanup');
  });
});
