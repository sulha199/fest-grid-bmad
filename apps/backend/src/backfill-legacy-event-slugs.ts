#!/usr/bin/env tsx
/**
 * Story 3.22 (FIND-071) -- one-time, idempotent backfill script that:
 *
 *   1. Heals any `posts` row whose `platformPostId`/`platformPostType` stayed null (pre-3.7f
 *      data, or a post that never got a new extraction job after 3.7f landed) but whose
 *      `postUrl`/`originalPostUrl` IS actually parseable -- the exact same derivation
 *      `processIngestionJob`'s inline healing already performs for a *new* extraction job
 *      touching a post (commit `8320a81`, 2026-10-05). This script is the only way to reach a
 *      post that will never get a new extraction job again.
 *   2. Re-keys any `events` row still on its legacy hex slug (`^[0-9a-f]{12}$`) to the
 *      platform-prefixed slug, once its primary post's identity is resolvable (after step 1) --
 *      through `event_slug_aliases`, so the old link keeps working as a redirect/alias-served
 *      lookup, never a 404 (AD-16 Rule 10, AD-30 Rule 2).
 *
 * An event/post whose URL is genuinely unparseable, or whose platform doesn't resolve via
 * `getPlatformSlug()`, is left untouched forever -- never a guessed value (AC2/AC4, AD-16 Rules
 * 4/5/12). This story performs no DDL (AC8) -- every column/table it writes to already exists.
 *
 * Modes (mirrors `backfill-post-media-keys.ts`'s exact shape):
 *
 *   tsx src/backfill-legacy-event-slugs.ts sizing
 *     Read-only. Reports: (a) posts needing identity healing that are resolvable, (b) posts
 *     needing healing that are not resolvable, (c) events eligible for re-keying whose post
 *     identity is (after a dry simulation) resolvable, (d) events that would remain permanently
 *     hex. Writes nothing.
 *
 *   tsx src/backfill-legacy-event-slugs.ts backfill [--apply]
 *     Without `--apply`: dry run. Runs the real healing/re-keying logic (Task 3/4's functions)
 *       inside one outer transaction that is always rolled back at the end -- the same
 *       "run the real logic, then discard" technique giving the dry run perfect fidelity with
 *       zero duplicate/hand-maintained "preview" logic. Logs what it would do; writes nothing
 *       durable.
 *     With `--apply`: runs `healPostPlatformIdentity` to completion, then `reslugLegacyEvents`
 *       to completion, both for real. No single outermost transaction wraps the real run --
 *       each function already wraps its own per-row/per-event write in its own small
 *       transaction (AC6); the outer apply/no-apply switch here only controls whether that
 *       wrapping transaction (dry-run case) commits or rolls back.
 *
 * Idempotent: an already-healed post, or an event whose slug no longer matches the legacy hex
 * shape, is skipped with zero writes on a re-run (AC6).
 */
import { TransactionRollbackError } from 'drizzle-orm';
import { db } from './db/client.js';
import { healPostPlatformIdentity, reslugLegacyEvents } from './lib/events/backfill-legacy-event-slugs-support.js';

interface SimulationResult {
  healed: number;
  postsStillUnresolvable: number;
  reslugged: number;
  eventsStillUnresolvable: number;
}

/**
 * Runs the real `healPostPlatformIdentity` + `reslugLegacyEvents` logic inside one transaction
 * that is always rolled back at the end, and returns what it *would* have done -- the shared
 * "run the real logic, then discard" technique both `runSizing` and `runBackfill`'s dry-run mode
 * depend on, so a simulated count can never drift from what a real `--apply` run would do.
 */
async function simulate(): Promise<SimulationResult> {
  let captured: SimulationResult | undefined;

  try {
    await db.transaction(async (tx) => {
      const postResult = await healPostPlatformIdentity(tx);
      const eventResult = await reslugLegacyEvents(tx);
      captured = {
        healed: postResult.healed,
        postsStillUnresolvable: postResult.stillUnresolvable,
        reslugged: eventResult.reslugged,
        eventsStillUnresolvable: eventResult.stillUnresolvable,
      };
      await tx.rollback();
    });
  } catch (err) {
    // tx.rollback() always rejects the transaction promise with TransactionRollbackError by
    // design -- that's how drizzle-orm signals "discard this transaction, don't commit" -- so
    // this exact rejection is expected and swallowed. Anything else propagates.
    if (!(err instanceof TransactionRollbackError)) {
      throw err;
    }
  }

  if (!captured) {
    throw new Error('simulate(): rolled-back transaction did not run to completion.');
  }
  return captured;
}

export interface SizingReport {
  postsNeedingHealingResolvable: number;
  postsNeedingHealingUnresolvable: number;
  eventsEligibleForReslugResolvable: number;
  eventsEligibleForReslugUnresolvable: number;
}

export async function runSizing(): Promise<SizingReport> {
  const sim = await simulate();
  const report: SizingReport = {
    postsNeedingHealingResolvable: sim.healed,
    postsNeedingHealingUnresolvable: sim.postsStillUnresolvable,
    eventsEligibleForReslugResolvable: sim.reslugged,
    eventsEligibleForReslugUnresolvable: sim.eventsStillUnresolvable,
  };
  console.log(`posts needing identity healing, resolvable: ${report.postsNeedingHealingResolvable}`);
  console.log(`posts needing identity healing, NOT resolvable (left untouched): ${report.postsNeedingHealingUnresolvable}`);
  console.log(`events eligible for re-keying (resolvable post identity): ${report.eventsEligibleForReslugResolvable}`);
  console.log(`events that will remain permanently hex (unresolvable post identity): ${report.eventsEligibleForReslugUnresolvable}`);
  return report;
}

export interface BackfillReport {
  healed: number;
  postsStillUnresolvable: number;
  reslugged: number;
  eventsStillUnresolvable: number;
}

export async function runBackfill(apply: boolean): Promise<BackfillReport> {
  if (!apply) {
    const sim = await simulate();
    console.log(`[DRY RUN] would heal ${sim.healed} post(s) identity, ${sim.postsStillUnresolvable} left unresolvable.`);
    console.log(`[DRY RUN] would re-key ${sim.reslugged} event(s) slug, ${sim.eventsStillUnresolvable} left permanently hex.`);
    return sim;
  }

  // Real run -- no outermost transaction; each function already wraps its own per-row/per-event
  // write in its own small transaction (AC6, never one giant transaction for the whole run).
  const postResult = await healPostPlatformIdentity(db);
  console.log(`Healed ${postResult.healed} post(s) identity, ${postResult.stillUnresolvable} left unresolvable.`);

  const eventResult = await reslugLegacyEvents(db);
  console.log(`Re-keyed ${eventResult.reslugged} event(s) slug, ${eventResult.stillUnresolvable} left permanently hex.`);

  return {
    healed: postResult.healed,
    postsStillUnresolvable: postResult.stillUnresolvable,
    reslugged: eventResult.reslugged,
    eventsStillUnresolvable: eventResult.stillUnresolvable,
  };
}

async function main() {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'sizing') {
    await runSizing();
    return;
  }

  if (mode === 'backfill') {
    const apply = rest.includes('--apply');
    await runBackfill(apply);
    return;
  }

  console.error('Usage:');
  console.error('  tsx src/backfill-legacy-event-slugs.ts sizing');
  console.error('  tsx src/backfill-legacy-event-slugs.ts backfill [--apply]');
  process.exit(1);
}

// Unlike backfill-post-media-keys.ts (whose own test file avoids importing it at all, testing
// only its lower-level helpers, to dodge exactly this), this story's own test file (Task 7)
// DOES import `runSizing`/`runBackfill` directly from this module -- so `main()` must only run
// when this file is executed as the actual CLI entrypoint (`tsx src/backfill-legacy-event-
// slugs.ts ...`), never as a side effect of another module importing it.
if (require.main === module) {
  main().catch((err) => {
    console.error('Backfill script failed:', err);
    process.exit(1);
  });
}
