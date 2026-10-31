import { and, eq } from 'drizzle-orm';
import { eventPosts, events, posts, socialMediaAccountProfiles } from '@festgrid/database';
import { assignExtractionOrdinals } from '@festgrid/domain';
import type { GeminiEventPayload } from '@festgrid/domain/events';
import { transformGeminiResponseToEventInfo } from '@festgrid/domain/events';
import { matchesChildrensDataKeywordFilter } from '@festgrid/domain/events';
import { parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import type { ProcessingJobMessage, ReextractionPreviewResult } from '@festgrid/domain/posts';
import type { DbExecutor } from '../events/set-event-primary-post.js';
import { evaluateIngestionMatch, type IngestionSourcePost } from '../ingestor/evaluate-ingestion-match.js';

// AD-40 -- the moderator re-extract preview. Turns a validated Gemini payload into what ingestion
// WOULD decide for each event, by calling the same `evaluateIngestionMatch` ingestion calls. It
// performs no writes: no events, schedules, event_posts, posts, audit-log or queue messages, and
// no geocoder or timezone calls (the venue signal is the location string only).

export interface ReextractionPayload {
  events: GeminiEventPayload[];
  groupingReason?: string | null;
  /** The post-level headline the model reported (`posts.title`), kept for Apply. */
  postTitle?: string | null;
}

export interface BuildReextractionPreviewInput {
  executor: DbExecutor;
  payload: ReextractionPayload;
  message: ProcessingJobMessage;
  postStored: boolean;
  rescraped: boolean;
  maxEvents: number;
  /** BUG-099 -- from the Gemini request builder: images the post lists / images actually sent. */
  imagesAvailable: number;
  imagesSent: number;
}

/** The post as ingestion sees it (with the in-memory platform-identity healing, minus the write). Shared with Apply. */
export async function loadSourcePost(executor: DbExecutor, postId: string): Promise<IngestionSourcePost | null> {
  const [row] = await executor
    .select({
      accountId: posts.accountId,
      platform: posts.platform,
      platformPostId: posts.platformPostId,
      platformPostType: posts.platformPostType,
      postUrl: posts.postUrl,
      originalPostUrl: posts.originalPostUrl,
      groupingReason: posts.groupingReason,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) return null;
  // Same in-memory healing ingestion does, minus the write: it only changes the derived slug.
  if (row.platformPostId === null || row.platformPostType === null) {
    const derived = parsePlatformPostIdentity({ postUrl: row.postUrl, originalPostUrl: row.originalPostUrl });
    if (derived.platformPostId !== null && derived.platformPostType !== null) {
      row.platformPostId = derived.platformPostId;
      row.platformPostType = derived.platformPostType;
    }
  }
  return row;
}

export async function buildReextractionPreview(input: BuildReextractionPreviewInput): Promise<ReextractionPreviewResult> {
  const { executor, payload, message, rescraped } = input;
  const keptEvents = payload.events.slice(0, input.maxEvents);

  const sourcePost = input.postStored ? await loadSourcePost(executor, message.postId) : null;
  // A post that was deleted between the start and the run is reported as not stored.
  const postStored = sourcePost !== null;
  // The extraction message carries the platform `account_id` string, not the profile uuid.
  let sourceSocialMediaAccountId = '';
  if (message.accountId) {
    const [profile] = await executor
      .select({ accountId: socialMediaAccountProfiles.accountId })
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, message.accountId))
      .limit(1);
    sourceSocialMediaAccountId = profile?.accountId ?? '';
  }

  const eventMessages = keptEvents.map((event) =>
    transformGeminiResponseToEventInfo(event, {
      postId: message.postId,
      sourceSocialMediaAccountId,
      resolvedScheduleLocations: new Map(),
      sourcePostText: message.content,
    })
  );
  const ordered = assignExtractionOrdinals(eventMessages);

  const previewEvents: ReextractionPreviewResult['events'] = [];
  for (const eventMessage of ordered) {
    const ordinal = eventMessage.extractionOrdinal ?? 0;
    const evaluation = await evaluateIngestionMatch(executor, eventMessage, sourcePost, {
      matchWithoutSourcePost: !postStored,
      groupingReason: payload.groupingReason ?? null,
    });

    let alreadyRepresentedBySlug: string | null = null;
    if (postStored) {
      const [existing] = await executor
        .select({ slug: events.slug })
        .from(eventPosts)
        .innerJoin(events, eq(events.id, eventPosts.eventId))
        .where(and(eq(eventPosts.postId, message.postId), eq(eventPosts.extractionOrdinal, ordinal)))
        .limit(1);
      alreadyRepresentedBySlug = existing?.slug ?? null;
    }

    const { match } = evaluation;
    previewEvents.push({
      extractionOrdinal: ordinal,
      eventName: evaluation.event.eventName,
      alreadyRepresentedBySlug,
      isStub: evaluation.isStub,
      links: (evaluation.event.links ?? []).map((link) => ({ url: link.url, label: link.label ?? null })),
      schedules: evaluation.scheduleValues.map((s) => ({
        title: s.title ?? null,
        startDate: s.eventStartDate ?? null,
        endDate: s.eventEndDate ?? null,
        isMain: s.isMainSchedule,
      })),
      dedup: match
        ? { tier: match.tier, score: match.score, candidateSlug: match.candidate.slug, candidateName: match.candidate.eventName }
        : { tier: 'none', score: null, candidateSlug: null, candidateName: null },
    });
  }

  return {
    groupingReason: payload.groupingReason ?? null,
    postStored,
    rescraped,
    imagesAvailable: input.imagesAvailable,
    imagesSent: input.imagesSent,
    events: previewEvents,
    // AD-40 (Apply): what a later Apply needs, with the one caption-derived fact computed now, while
    // the caption exists. The caption itself is never kept.
    extracted: (() => {
      const childrensDataMatch = matchesChildrensDataKeywordFilter(message.content);
      return {
        // Stored for Apply, so it gets the same discard-at-classification the event builder applies
        // (transformGeminiResponseToEventInfo): a raw private contact or a child performer's name
        // must not sit in a job row, applied or not. Apply's transform repeats both rules.
        events: keptEvents.map((event) => ({
          ...event,
          contactInfo: event.hasPrivateContact === true ? undefined : event.contactInfo,
          schedules: childrensDataMatch ? event.schedules.map((schedule) => ({ ...schedule, performers: undefined })) : event.schedules,
        })),
        groupingReason: payload.groupingReason ?? null,
        postTitle: payload.postTitle?.trim().slice(0, 200) || null,
        childrensDataMatch,
      };
    })(),
  };
}
