import { and, eq, isNull, sql } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { parseExtractionCursor, type ExtractionCursor } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { CLEAN_EXTRACTION_LEDGER } from './extraction-ledger.js';

// AD-47 Rules 1, 3, 4 and 5b -- the one place that reads and writes `posts.extraction_cursor`. Every write is a
// compare-and-set on (step count, lease nonce), so a redelivered or resumed duplicate of a step cannot overwrite a
// newer one. Callers get plain booleans or the parsed cursor, never a half-trusted row.
//
// The cursor is written through `::text::jsonb`: drizzle's jsonb mapper would JSON.stringify an object and the driver
// would then store that string as a JSON string (the double-encoding found on older jsonb columns).

export type CursorLease = Pick<ExtractionCursor, 'stepCount' | 'leaseNonce'>;

// Postgres cannot store a NUL character in jsonb and rejects the whole value; the strings in a cursor derive from model
// output (the dedupe keys), so they are stripped of it rather than left to fail every commit of the chain.
const withoutNul = (_key: string, value: unknown) => (typeof value === 'string' ? value.replace(/\u0000/g, '') : value);
const jsonb = (cursor: ExtractionCursor) => sql`${JSON.stringify(cursor, withoutNul)}::text::jsonb`;

const leaseMatches = (lease: CursorLease) =>
  and(
    sql`(${posts.extractionCursor}->>'stepCount')::int = ${lease.stepCount}`,
    sql`${posts.extractionCursor}->>'leaseNonce' = ${lease.leaseNonce}`
  );

/** The post's cursor, or null when there is none or the stored value is not a well-formed cursor. */
export async function readExtractionCursor(postId: string): Promise<ExtractionCursor | null> {
  const [row] = await db.select({ cursor: posts.extractionCursor }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row || row.cursor === null) {
    return null;
  }
  const cursor = parseExtractionCursor(row.cursor);
  if (cursor === null) {
    console.error(`[extraction-cursor] post=${postId} holds a cursor that does not parse; treating it as none`);
  }
  return cursor;
}

/** Starts a chain: stores the first cursor only when the post is unextracted and has none. */
export async function startExtractionCursor(postId: string, cursor: ExtractionCursor): Promise<boolean> {
  const updated = await db
    .update(posts)
    .set({ extractionCursor: jsonb(cursor), extractionPartial: false })
    .where(and(eq(posts.id, postId), eq(posts.isExtracted, false), isNull(posts.extractionCursor)))
    .returning({ id: posts.id });
  return updated.length > 0;
}

/**
 * Commits a step: replaces the cursor only while the stored one still carries the expected (step count, lease nonce).
 * False means another writer got there first (or the chain ended); the caller must stop before any side effect.
 */
export async function advanceExtractionCursor(postId: string, expected: CursorLease, next: ExtractionCursor): Promise<boolean> {
  // A cursor for another post, or one that moves the step count backwards, is a caller bug, never a commit.
  if (next.postId !== postId || next.stepCount < expected.stepCount) {
    return false;
  }
  const updated = await db
    .update(posts)
    .set({ extractionCursor: jsonb(next) })
    .where(and(eq(posts.id, postId), eq(posts.isExtracted, false), leaseMatches(expected)))
    .returning({ id: posts.id });
  return updated.length > 0;
}

/**
 * Takes (or hands over) the lease: swaps in a new nonce while the stored (step count, nonce) still match. Returns the
 * cursor now stored, or null when the lease could not be taken. The resume pass uses the same function and bumps the
 * nonce only, never the step count (AD-47 Rule 4).
 */
export async function takeExtractionLease(postId: string, expected: CursorLease, newNonce: string): Promise<ExtractionCursor | null> {
  // Swapping a nonce for itself would let two takers both "win".
  if (newNonce === expected.leaseNonce) {
    return null;
  }
  const current = await readExtractionCursor(postId);
  if (current === null || current.stepCount !== expected.stepCount || current.leaseNonce !== expected.leaseNonce) {
    return null;
  }
  const next: ExtractionCursor = { ...current, leaseNonce: newNonce };
  return (await advanceExtractionCursor(postId, expected, next)) ? next : null;
}

/**
 * The atomic stop of a chain (AD-47 Rule 5b): cursor null, extracted, the partial flag for the outcome and a clean retry
 * ledger, in one write, by the lease holder. False when the lease no longer matches, or the post was already extracted
 * or is gone.
 */
export async function finishExtractionChain(postId: string, lease: CursorLease, outcome: { partial: boolean }): Promise<boolean> {
  // Only the holder of the current lease may end the chain: a stale or redelivered handler must not end a newer one's.
  const updated = await db
    .update(posts)
    .set({ isExtracted: true, extractionCursor: null, extractionPartial: outcome.partial, ...CLEAN_EXTRACTION_LEDGER })
    .where(and(eq(posts.id, postId), eq(posts.isExtracted, false), leaseMatches(lease)))
    .returning({ id: posts.id });
  return updated.length > 0;
}
