import { and, eq, inArray } from 'drizzle-orm';
import { eventPosts, events, manualExtractionJobs, posts, schedules } from '@festgrid/database';
import {
  REEXTRACT_APPLY_WINDOW_MS,
  isPostGroupingReason,
  postGroupingReasonToGraphQL,
  type ApplyReextractionEventRef,
  type ApplyReextractionSummary,
  type ManualExtractionRequestPayload,
  type ReextractionPreviewResult,
} from '@festgrid/domain/posts';
import { assignApplyOrdinals, assignExtractionOrdinals, buildEventInsertValues, pairPostEventsToItems, slugImpliedOrdinal } from '@festgrid/domain/events';
import type { ExtractedEventMessage } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { buildExtractedEventMessage } from '../ai-processor/build-extracted-event-message.js';
import { loadSourcePost } from '../ai-processor/build-reextraction-preview.js';
import { PARKED_ORDINAL_BASE, enrichAndPromoteEvent, setEventPostOrdinal } from '../events/set-event-primary-post.js';
import { evaluateIngestionMatch, resolveStubSource } from '../ingestor/evaluate-ingestion-match.js';
import { writeIngestionDecision } from '../ingestor/write-ingestion-decision.js';
import { getActiveSubscriberUserIdsForPost } from '../subscriptions/get-active-subscriber-user-ids-for-post.js';

// AD-40 (Apply) -- the one write a moderator re-extract can make. It takes the exact extraction the
// moderator previewed (stored on the preview job: no new Gemini call, no caption) and, in ONE
// transaction, makes the post look like that extraction: the post's grouping and title are rewritten,
// the events the post already produced are reused (same id and slug, so favorites, calendar entries and
// aliases survive), and the remaining items are ingested through the same write path as ingestion.
// Never deletes an event, never recreates one a moderator deleted (PRD 3.7), never notifies.

export type ApplyPostReextractionErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'NOT_STORED' | 'NOTHING_TO_APPLY' | 'APPLY_FAILED';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApplyPostReextractionResult =
  | { summary: ApplyReextractionSummary }
  | { errorCode: ApplyPostReextractionErrorCode; errorMessage: string };

const fail = (errorCode: ApplyPostReextractionErrorCode, errorMessage: string) => ({ errorCode, errorMessage }) as const;

/** The post whose events are being applied, as the transaction needs it. */
type PostRow = typeof posts.$inferSelect;

export async function applyPostReextraction(userId: string, jobId: string, now: Date = new Date()): Promise<ApplyPostReextractionResult> {
  // Owner-scoped, like every manual job read: another moderator's job is NOT_FOUND, not forbidden.
  // A malformed id is a NOT_FOUND too, not a database error.
  if (!UUID_PATTERN.test(jobId)) return fail('NOT_FOUND', 'Preview not found, or it has not finished.');
  const [job] = await db
    .select()
    .from(manualExtractionJobs)
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.requestedByUserId, userId)))
    .limit(1);
  const requestPayload = job?.requestPayload as ManualExtractionRequestPayload | undefined;
  if (!job || requestPayload?.mode !== 'REEXTRACT_PREVIEW' || job.status !== 'SUCCEEDED') {
    return fail('NOT_FOUND', 'Preview not found, or it has not finished.');
  }

  const result = job.resultData as ReextractionPreviewResult | null;
  if (result?.applied) return { summary: result.applied };

  const finishedAt = job.completedAt ?? job.updatedAt;
  if (!result?.extracted || now.getTime() - finishedAt.getTime() > REEXTRACT_APPLY_WINDOW_MS) {
    return fail('EXPIRED', 'This preview can no longer be applied (it is too old, or predates Apply). Run the preview again.');
  }
  const extracted = result.extracted;
  // "Not an event" is a fine preview, but applying it would rewrite the post's grouping, blank its
  // title and orphan every event it has, with nothing to put in their place.
  if (extracted.events.length === 0) return fail('NOTHING_TO_APPLY', 'This preview found no events, so there is nothing to apply.');

  if (!result.postStored) return fail('NOT_STORED', 'Only a post that is stored can be applied.');
  const [post] = await db.select().from(posts).where(eq(posts.id, requestPayload.message.postId)).limit(1);
  if (!post) return fail('NOT_STORED', 'Only a post that is stored can be applied.');

  try {
    // Network work (geocoding, timezone lookups) happens BEFORE the transaction, so no database
    // connection is held open while it waits.
    const subscriberUserIds = await getActiveSubscriberUserIdsForPost(post.id, post.accountId);
    const messages: ExtractedEventMessage[] = [];
    for (const event of extracted.events) {
      const { eventMessage } = await buildExtractedEventMessage(event, {
        postId: post.id,
        accountId: post.accountId,
        subscriberUserIds,
        childrensDataMatch: extracted.childrensDataMatch,
      });
      messages.push(eventMessage);
    }

    const applied = await db.transaction(async (tx) => {
      // Serializes applies of one POST (two previews of it, or a double click): the second waits here
      // and then pairs against whatever the first wrote. The post lock comes before the job lock in
      // every apply, so two applies cannot deadlock on the pair.
      await tx.select({ id: posts.id }).from(posts).where(eq(posts.id, post.id)).for('update');
      // Serializes two applies of one job: the second waits here, then sees `applied` and returns it.
      const [locked] = await tx
        .select({ resultData: manualExtractionJobs.resultData })
        .from(manualExtractionJobs)
        .where(eq(manualExtractionJobs.id, jobId))
        .for('update');
      const current = locked?.resultData as ReextractionPreviewResult | null;
      if (current?.applied) return { summary: current.applied, committed: null };

      const summary = await applyInTransaction(tx, post, messages, extracted.groupingReason, extracted.postTitle);

      await tx
        .update(manualExtractionJobs)
        .set({
          resultData: { ...(current ?? result), extracted: null, appliedAt: now.toISOString(), applied: summary.summary } satisfies ReextractionPreviewResult,
          updatedAt: new Date(),
        })
        .where(eq(manualExtractionJobs.id, jobId));
      return { summary: summary.summary, committed: summary.journal };
    });

    // The journal line (there is no undo): which events were touched, written after the commit so a
    // rolled-back attempt never claims it happened.
    if (applied.committed) {
      console.log(JSON.stringify({ event: 'reextract_apply', jobId, postId: post.id, userId, ...applied.committed }));
    }
    return { summary: applied.summary };
  } catch (error) {
    console.error(`[applyPostReextraction] job ${jobId} failed and was rolled back:`, error);
    return fail('APPLY_FAILED', 'The preview could not be applied, and nothing was changed. Please try again.');
  }
}

interface AppliedSummary {
  summary: ApplyReextractionSummary;
  /** Event ids, for the journal line. */
  journal: { reusedEventIds: string[]; createdEventIds: string[]; linkedEventIds: string[] };
}

async function applyInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  post: PostRow,
  messages: ExtractedEventMessage[],
  groupingReason: string | null,
  postTitle: string | null
): Promise<AppliedSummary> {
  // What the post already has: every event linked to it, live or not.
  const links = await tx
    .select({
      eventId: eventPosts.eventId,
      ordinal: eventPosts.extractionOrdinal,
      slug: events.slug,
      eventName: events.eventName,
      deletedAt: events.deletedAt,
      mergedInto: events.mergedIntoEventId,
      primaryPostId: events.postId,
      detailLevel: events.detailLevel,
    })
    .from(eventPosts)
    .innerJoin(events, eq(events.id, eventPosts.eventId))
    .where(eq(eventPosts.postId, post.id));

  const startDatesByEvent = new Map<string, string[]>();
  if (links.length > 0) {
    const scheduleRows = await tx
      .select({ eventId: schedules.eventId, startDate: schedules.eventStartDate })
      .from(schedules)
      .where(inArray(schedules.eventId, links.map((l) => l.eventId)));
    for (const row of scheduleRows) {
      if (!row.startDate) continue;
      const dates = startDatesByEvent.get(row.eventId) ?? [];
      dates.push(row.startDate);
      startDatesByEvent.set(row.eventId, dates);
    }
  }

  // Pair by name and date, never by ordinal (they shift when the event set grows).
  const pairing = pairPostEventsToItems(
    links.map((l) => ({ id: l.eventId, eventName: l.eventName, startDates: startDatesByEvent.get(l.eventId) ?? [], deleted: l.deletedAt !== null || l.mergedInto !== null })),
    messages.map((m, index) => ({ index, eventName: m.eventName, startDates: m.schedules.map((s) => s.eventStartDate) }))
  );
  const reusedByIndex = new Map<number, string>();
  let skippedDeleted = 0;
  for (const item of pairing.items) {
    if (item.kind === 'reuse') reusedByIndex.set(item.index, item.eventId);
    else if (item.kind === 'skip') skippedDeleted++;
  }

  // The items Apply keeps, in the order ingestion would number them, with ordinals that step around
  // the slots still held by events that do not move (orphans, and deleted or merged events).
  const kept = assignExtractionOrdinals(
    messages.map((message, index) => ({ ...message, applyIndex: index })).filter((m) => pairing.items[m.applyIndex].kind !== 'skip')
  );
  const movingEventIds = new Set(reusedByIndex.values());
  const slugOrdinalOf = new Map(links.map((l) => [l.eventId, slugImpliedOrdinal(l.slug)]));
  const staying = links.filter((l) => !movingEventIds.has(l.eventId));
  const finalOrdinals = assignApplyOrdinals(
    kept.map((m) => ({ reused: reusedByIndex.has(m.applyIndex) })),
    staying.map((l) => l.ordinal),
    [...movingEventIds].map((id) => slugOrdinalOf.get(id) ?? null),
    // An orphan or deleted event keeps its slug even when an earlier Apply left it at another ordinal.
    staying.map((l) => slugOrdinalOf.get(l.eventId) ?? null)
  );

  // Grouping and title first: the stub rule below reads the post's (new) grouping.
  await tx
    .update(posts)
    .set({ groupingReason: groupingReason as PostRow['groupingReason'], extractedEventCount: messages.length, title: postTitle })
    .where(eq(posts.id, post.id));
  const sourcePost = await loadSourcePost(tx, post.id);

  // Park every moving event at its own temporary ordinal so no step of the re-numbering can collide
  // with a sibling (`NULL` is not an option: `events` forbids a null ordinal on a primary post).
  for (const [i, eventId] of [...movingEventIds].entries()) {
    await setEventPostOrdinal(tx, { eventId, postId: post.id, extractionOrdinal: PARKED_ORDINAL_BASE + i });
  }

  const summary: ApplyReextractionSummary = { groupingReason, reused: [], created: [], linkedToExisting: [], queuedForReview: 0, skippedDeleted, orphans: [] };
  const journal = { reusedEventIds: [] as string[], createdEventIds: [] as string[], linkedEventIds: [] as string[] };
  const { isStub } = await resolveStubSource(tx, post.id, groupingReason);

  for (const [position, keptMessage] of kept.entries()) {
    const ordinal = finalOrdinals[position];
    const { applyIndex, ...rest } = keptMessage;
    const message: ExtractedEventMessage = { ...rest, extractionOrdinal: ordinal };
    const reusedEventId = reusedByIndex.get(applyIndex);

    if (reusedEventId) {
      const [existing] = await tx.select().from(events).where(eq(events.id, reusedEventId)).limit(1);
      let reusedRow = existing;
      if (existing.postId === post.id) {
        // This post is the event's own source: it takes the fresh extraction (a schedule the new
        // extraction no longer lists is removed unless a calendar entry uses it; fields named by an
        // applied correction keep their value). The slug is stripped so no re-slug can happen: a
        // reused event keeps its address, and a new slug could collide with another event's.
        const { event, schedules: scheduleValues } = buildEventInsertValues(message, sourcePost ?? null);
        const { slug: _derivedSlug, ...eventWithoutSlug } = event;
        const enriched = await enrichAndPromoteEvent(tx, existing, eventWithoutSlug, scheduleValues, post.id, ordinal);
        reusedRow = enriched.event;
        // A stub means "this roundup post is all there is": demoted only because this post is its
        // primary post (and the post is a roundup or curator post).
        if (isStub && existing.detailLevel !== 'stub') {
          await tx.update(events).set({ detailLevel: 'stub' }).where(eq(events.id, reusedEventId));
        }
      }
      // An event whose primary post is ANOTHER post (typically the organizer's own) is left exactly
      // as it is: the roundup is a thin source, and the organizer's data and detail level win. It
      // only keeps this post's link, under the new ordinal.
      await setEventPostOrdinal(tx, { eventId: reusedEventId, postId: post.id, extractionOrdinal: ordinal });
      summary.reused.push({ slug: reusedRow.slug, eventName: reusedRow.eventName, ordinal });
      journal.reusedEventIds.push(reusedEventId);
      continue;
    }

    // A new item: the very decision and write ingestion makes (dedup tier, stub, insert or enrich).
    const evaluation = await evaluateIngestionMatch(tx, message, sourcePost);
    const written = await writeIngestionDecision(tx, message, ordinal, evaluation);
    if (!written.inserted || !written.event) {
      throw new Error(`slot (${post.id}, ${ordinal}) was taken while applying`);
    }
    const ref: ApplyReextractionEventRef = { slug: written.event.slug, eventName: written.event.eventName };
    if (evaluation.match?.tier === 'high') {
      summary.linkedToExisting.push(ref);
      journal.linkedEventIds.push(written.event.id);
    } else {
      summary.created.push({ ...ref, ordinal });
      journal.createdEventIds.push(written.event.id);
      if (evaluation.match?.tier === 'mid') summary.queuedForReview++;
    }
  }

  const orphanIds = new Set(pairing.orphanEventIds);
  summary.orphans = links.filter((l) => orphanIds.has(l.eventId)).map((l) => ({ slug: l.slug, eventName: l.eventName }));
  return { summary, journal };
}

/** The summary in the shape `extraction.graphql` declares (the grouping reason as its GraphQL enum member). */
export function toGraphQLApplySummary(summary: ApplyReextractionSummary) {
  return {
    ...summary,
    groupingReason: summary.groupingReason && isPostGroupingReason(summary.groupingReason) ? postGroupingReasonToGraphQL(summary.groupingReason) : null,
  };
}
