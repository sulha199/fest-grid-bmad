import { eq, sql } from 'drizzle-orm';
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
// Returns true iff this call claimed/renewed the lock (no row, or an already-expired row);
// returns false iff another, still-live lease already holds the key.
async function claimLock(lockKey: string, ttlMs: number): Promise<boolean> {
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
    .returning();
  return rows.length > 0;
}

// Releases a claimed lease immediately by setting `lockedUntil` to now() -- making the key
// claimable again right away, rather than waiting out the full TTL.
async function releaseLock(lockKey: string): Promise<void> {
  await db
    .update(vendorCallLocks)
    .set({ lockedUntil: sql`now()` })
    .where(eq(vendorCallLocks.lockKey, lockKey));
}

// Races `call(signal)` against a `timeoutMs` timer. On expiry, aborts `signal` and throws
// VendorCallTimeoutError -- a generic bound independent of whatever cancellation support (or
// lack of it) the thunk itself has.
async function callWithTimeout<T>(call: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new VendorCallTimeoutError(`Vendor call timed out after ${timeoutMs}ms`));
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

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // (a) DPA gate -- before anything else, never retried, never touches the lock table.
    assertDpaConfirmed(vendor);

    // (b) Lock claim -- never retried on a busy key.
    let lockClaimed = false;
    if (opts.lockKey !== undefined) {
      lockClaimed = await claimLock(opts.lockKey, lockTtlMs);
      if (!lockClaimed) {
        throw new VendorKeyBusyError(`Vendor call lock busy for key "${opts.lockKey}"`);
      }
    }

    try {
      // (c) Timed, abortable call.
      return await callWithTimeout(opts.call, opts.timeoutMs);
    } catch (error) {
      // VendorCallTimeoutError is always immediate and unretried (AC5/AC6).
      if (error instanceof VendorCallTimeoutError) {
        throw error;
      }

      const attemptsRemain = attempt < maxAttempts;
      if (attemptsRemain && opts.isTransient(error)) {
        const delayMs = computeBackoffDelayMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw error;
    } finally {
      // (d) Release the lock in a finally -- guaranteed on every exit path.
      if (lockClaimed && opts.lockKey !== undefined) {
        await releaseLock(opts.lockKey);
      }
    }
  }

  // Unreachable: the loop above always either returns or throws before falling off the end.
  throw new Error('callVendor: exhausted attempts without returning or throwing (unreachable).');
}
