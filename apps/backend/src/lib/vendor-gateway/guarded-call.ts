import { and, eq, sql } from 'drizzle-orm';
import { computeBackoffDelayMs } from '@festgrid/domain';
import { vendorCallLocks } from '@festgrid/database';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// Story 0.i2a (AD-32) — one wrapper around every outbound vendor call (Gemini, Apify, Bright
// Data) that enforces, in this exact order, a per-key lease lock, a wrapper-level timeout with
// best-effort cancellation, retry-with-backoff (classification supplied by the caller, never
// guessed here), and a DPA-confirmation gate. This module builds the mechanism only -- no
// existing call site is adopted onto it by this story (that's Stories 0.i2b/0.i2c/0.i2d).

export type VendorName = 'gemini' | 'apify' | 'brightdata';

export class VendorKeyBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorKeyBusyError';
  }
}

export class VendorDpaNotConfirmedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorDpaNotConfirmedError';
  }
}

export class VendorCallTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorCallTimeoutError';
  }
}

export interface CallVendorOptions<T> {
  // Credential identity to lock on. Omitted => the lock claim/release step is skipped entirely
  // (AC4) -- supports callers with no stable credential identity to lock against yet.
  lockKey?: string;
  // Wrapper-level bound (AC5). Applies even if `call`'s thunk ignores the AbortSignal it is
  // handed -- a thunk that *does* honor it gets real cancellation on top of the bound.
  timeoutMs: number;
  // Overall execution budget across ALL attempts and backoff delays (optional). Each attempt's
  // timeout is capped to what remains of this budget, and no retry starts unless backoff plus a
  // minimal attempt still fits -- so a caller bounded by a Lambda timeout can set this below
  // that limit and get a typed error (and lease cleanup) instead of being killed mid-retry.
  overallTimeoutMs?: number;
  // Total attempts, including the first. Default 3 (Dev Notes: bounds retry storms, matches
  // this codebase's existing small-retry-count convention).
  maxAttempts?: number;
  // Lease TTL in ms. Default: Math.max(timeoutMs * 2, 60_000) -- ties the crash-safety-net
  // window to the call's own declared timeout rather than one hardcoded global constant.
  lockTtlMs?: number;
  // Caller-supplied transient-failure classifier (AD-32 Rule 4) -- this wrapper never guesses a
  // vendor's error shape. Only consulted for errors thrown by `call` itself; never consulted for
  // VendorCallTimeoutError, VendorKeyBusyError, or VendorDpaNotConfirmedError, which are always
  // immediate and unretried.
  isTransient: (error: unknown) => boolean;
  // The actual vendor call. Receives this attempt's AbortSignal so a cancellation-aware
  // implementation (e.g. Gemini's SDK) can abort the real underlying request on timeout.
  call: (signal: AbortSignal) => Promise<T>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const MIN_LOCK_TTL_MS = 60_000;
// A retry is only worth starting if at least this much of the overall budget is left after backoff.
const MIN_RETRY_ATTEMPT_MS = 1_000;

function assertDpaConfirmed(vendor: VendorName): void {
  // Gemini must have zero branches referencing any DPA flag -- not even a no-op check (AC7).
  if (vendor === 'gemini') {
    return;
  }
  const env = loadBackendEnv();
  const confirmed = vendor === 'apify' ? env.apifyScrapingConfirmed : env.brightdataScrapingConfirmed;
  if (!confirmed) {
    throw new VendorDpaNotConfirmedError(
      `DPA not confirmed for vendor "${vendor}" -- set ${vendor === 'apify' ? 'APIFY_SCRAPING_CONFIRMED' : 'BRIGHTDATA_SCRAPING_CONFIRMED'}="true" (or leave unset) to allow calls.`
    );
  }
}

// Atomically claims the lease row for `lockKey`, extending `lockedUntil` by `ttlMs` from now.
// Returns an ownership token (the claimed `lockedUntil` as exact epoch text) iff this call
// claimed/renewed the lock (no row, or an already-expired row); returns null iff another,
// still-live lease already holds the key. The token lets release prove it still owns the lease.
async function claimLock(lockKey: string, ttlMs: number): Promise<string | null> {
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  const rows = await db
    .insert(vendorCallLocks)
    .values({
      lockKey,
      lockedUntil: sql`now() + interval '1 second' * ${ttlSeconds}`,
    })
    .onConflictDoUpdate({
      target: vendorCallLocks.lockKey,
      set: {
        lockedUntil: sql`now() + interval '1 second' * ${ttlSeconds}`,
      },
      setWhere: sql`${vendorCallLocks.lockedUntil} < now()`,
    })
    .returning({ token: sql<string>`extract(epoch from ${vendorCallLocks.lockedUntil})::text` });
  return rows.length > 0 ? rows[0].token : null;
}

// Releases a claimed lease immediately by setting `lockedUntil` to now() -- making the key
// claimable again right away, rather than waiting out the full TTL. Conditional on the claim
// token: if this lease expired mid-call and another caller has since reclaimed the key, that
// caller's live lease is left untouched (the token no longer matches).
async function releaseLock(lockKey: string, token: string): Promise<void> {
  await db
    .update(vendorCallLocks)
    .set({ lockedUntil: sql`now()` })
    .where(
      and(
        eq(vendorCallLocks.lockKey, lockKey),
        sql`extract(epoch from ${vendorCallLocks.lockedUntil})::text = ${token}`
      )
    );
}

// Races `call(signal)` against a `timeoutMs` timer. On expiry, aborts `signal` and throws
// VendorCallTimeoutError -- a generic bound independent of whatever cancellation support (or
// lack of it) the thunk itself has.
async function callWithTimeout<T>(call: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      // Reject BEFORE aborting: abort listeners run synchronously, and a thunk that rejects from
      // its own abort listener would otherwise win the race and surface its error (possibly a
      // retryable one) instead of VendorCallTimeoutError.
      reject(new VendorCallTimeoutError(`Vendor call timed out after ${timeoutMs}ms`));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([call(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function callVendor<T>(vendor: VendorName, opts: CallVendorOptions<T>): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const lockTtlMs = opts.lockTtlMs ?? Math.max(opts.timeoutMs * 2, MIN_LOCK_TTL_MS);

  // A lease that can expire while its own attempt is still running would let a second caller
  // claim the key concurrently -- defeating the lock. Reject that configuration up front.
  if (opts.lockKey !== undefined && lockTtlMs <= opts.timeoutMs) {
    throw new RangeError(
      `callVendor: lockTtlMs (${lockTtlMs}) must exceed timeoutMs (${opts.timeoutMs}) so the lease outlives the attempt it protects.`
    );
  }

  const deadlineAt = opts.overallTimeoutMs !== undefined ? Date.now() + opts.overallTimeoutMs : undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // (a) DPA gate -- before anything else, never retried, never touches the lock table.
    assertDpaConfirmed(vendor);

    // (b) Lock claim -- never retried on a busy key.
    let lockToken: string | null = null;
    if (opts.lockKey !== undefined) {
      lockToken = await claimLock(opts.lockKey, lockTtlMs);
      if (lockToken === null) {
        throw new VendorKeyBusyError(`Vendor call lock busy for key "${opts.lockKey}"`);
      }
    }

    try {
      // Cap this attempt to the remaining overall budget, computed AFTER the claim (which may
      // have waited on the database) and inside the try so the lease is always released.
      let attemptTimeoutMs = opts.timeoutMs;
      if (deadlineAt !== undefined) {
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          throw new VendorCallTimeoutError(`Vendor call exceeded its overall ${opts.overallTimeoutMs}ms budget`);
        }
        attemptTimeoutMs = Math.min(opts.timeoutMs, remainingMs);
      }

      // (c) Timed, abortable call.
      return await callWithTimeout(opts.call, attemptTimeoutMs);
    } catch (error) {
      // VendorCallTimeoutError is always immediate and unretried (AC5/AC6).
      if (error instanceof VendorCallTimeoutError) {
        throw error;
      }

      const attemptsRemain = attempt < maxAttempts;
      if (attemptsRemain && opts.isTransient(error)) {
        const delayMs = computeBackoffDelayMs(attempt);
        // Do not start a retry that cannot finish inside the overall budget: surface the real
        // error now, while there is still time for lease cleanup.
        if (deadlineAt !== undefined && Date.now() + delayMs + MIN_RETRY_ATTEMPT_MS > deadlineAt) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw error;
    } finally {
      // (d) Release the lock in a finally -- guaranteed on every exit path, ownership-checked.
      if (lockToken !== null && opts.lockKey !== undefined) {
        await releaseLock(opts.lockKey, lockToken);
      }
    }
  }

  // Unreachable: the loop above always either returns or throws before falling off the end.
  throw new Error('callVendor: exhausted attempts without returning or throwing (unreachable).');
}
