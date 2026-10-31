import type { GeminiEventPayload } from '../events/types.js';

/**
 * Closed role vocabulary for `post_account_associations` rows (Story 3.15, PRD §4.7a,
 * Architecture Spine AD-25/AD-31). Declared once per AD-31 Rule 2.
 */
export const POST_ACCOUNT_ROLES = ['PUBLISHER', 'COAUTHOR', 'SCRAPING_SOURCE', 'PUBLISHER_UNKNOWN'] as const;
export type PostAccountRole = (typeof POST_ACCOUNT_ROLES)[number];

/**
 * Closed set for posts.grouping_reason (Architecture Spine AD-30 Rule 1/5, Story 3.6r). Set by
 * the multi-event extraction payload's post-level `groupingReason` (Story 3.6s) -- this story
 * only adds the persisted column/enum the field will eventually populate.
 */
export const POST_GROUPING_REASONS = ['single-event', 'program-lineup', 'dependent-stages', 'separate-events', 'roundup'] as const;
export type PostGroupingReason = (typeof POST_GROUPING_REASONS)[number];

export function isPostGroupingReason(value: string): value is PostGroupingReason {
  return (POST_GROUPING_REASONS as readonly string[]).includes(value);
}

/**
 * Closed set describing which image shape the AI actually saw for a given extraction attempt
 * (Story 3.21, Architecture Spine AD-29 Rule 7). Computed once per attempt by
 * `buildGeminiExtractionRequest` and persisted on `extraction_audit_logs.ai_image_input` by
 * `writeExtractionAuditLog` -- see that function's own call sites in `process-ai-job.ts` for the
 * exact precedence used to derive it.
 */
export const AI_IMAGE_INPUT_VALUES = [
  'blurred',
  'original_owner_opted_in',
  'original_mode_off',
  'text_only_fail_closed',
  'no_image_sent',
] as const;
export type AiImageInput = (typeof AI_IMAGE_INPUT_VALUES)[number];

/**
 * Story 4.2b -- lifecycle of a manual ("AI-Assisted Correction") extraction job, tracked in
 * `manual_extraction_jobs`. `PENDING` -> `PROCESSING` (claimed by the AI Lambda) -> `SUCCEEDED` |
 * `FAILED`. The GraphQL `ExtractionJobStatus` enum mirrors these values 1:1.
 */
export const MANUAL_EXTRACTION_JOB_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'] as const;
export type ManualExtractionJobStatus = (typeof MANUAL_EXTRACTION_JOB_STATUSES)[number];

export function isManualExtractionJobTerminal(status: ManualExtractionJobStatus): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED';
}

/** Story 4.2b -- a job older than this without reaching a terminal status is reported FAILED. */
export const MANUAL_EXTRACTION_JOB_STALE_AFTER_MS = 5 * 60 * 1000;

/** Story 4.2b -- the asynchronous-invoke payload the API Lambda sends the AI Lambda. */
export interface ManualExtractionInvokePayload {
  jobType: 'manual-extraction';
  jobId: string;
}

/**
 * Story 4.2b -- what the API Lambda persists in `manual_extraction_jobs.request_payload` after its
 * synchronous pre-checks: the `ProcessingJobMessage`-shaped input for the Gemini request plus the
 * branch facts the AI Lambda needs. `existingPostAccountId` is set only for the existing-post
 * branch (TIER_2 shared-key fallback keys off that account's subscribers).
 */
export interface ManualExtractionRequestPayload {
  message: ProcessingJobMessage;
  existingPostAccountId?: string;
  /**
   * AD-40 -- `REEXTRACT_PREVIEW` runs the moderator re-extract preview (extraction plus a dry-run
   * of the ingestion dedup decision) instead of the single-event correction proposal. Absent means
   * the Story 4.2b correction flow.
   */
  mode?: ManualExtractionMode;
  /** AD-40 -- preview facts known when the job is started, echoed into the result. */
  postStored?: boolean;
  rescraped?: boolean;
}

export const MANUAL_EXTRACTION_MODES = ['CORRECTION', 'REEXTRACT_PREVIEW'] as const;
export type ManualExtractionMode = (typeof MANUAL_EXTRACTION_MODES)[number];

/** AD-40 -- a dedup outcome in a re-extract preview. `none` means no candidate passed the query. */
export type ReextractionPreviewTier = 'high' | 'mid' | 'low' | 'none';

export interface ReextractionPreviewEvent {
  extractionOrdinal: number;
  eventName: string;
  /** Ingestion would skip this item: the post's `(post, ordinal)` slot already has this event (slug). */
  alreadyRepresentedBySlug: string | null;
  /** Roundup- or curator-sourced events are stubs (AD-30 Rule 10). */
  isStub: boolean;
  links: Array<{ url: string; label?: string | null }>;
  schedules: Array<{ title: string | null; startDate: string | null; endDate: string | null; isMain: boolean }>;
  dedup: {
    tier: ReextractionPreviewTier;
    score: number | null;
    candidateSlug: string | null;
    candidateName: string | null;
  };
}

/**
 * AD-40 (Apply) -- what a preview job keeps so Apply needs neither a new Gemini call nor the caption
 * (blanked once the job ends): the validated events (capped as ingestion caps them), the post-level
 * grouping and title, and the children's-data keyword filter's verdict, which is the one thing the
 * event builder derives from the caption. Never the caption itself.
 */
export interface ReextractionExtracted {
  events: GeminiEventPayload[];
  groupingReason: string | null;
  postTitle: string | null;
  childrensDataMatch: boolean;
}

export interface ApplyReextractionEventRef {
  slug: string;
  eventName: string;
}

/** AD-40 (Apply) -- what an apply did, kept on the job (so a second apply returns it) and shown to the moderator. */
export interface ApplyReextractionSummary {
  groupingReason: string | null;
  /** Events the post already had, now continuing an extracted item (still the same id and slug). */
  reused: Array<ApplyReextractionEventRef & { ordinal: number }>;
  /** New stub events linked to the post. */
  created: Array<ApplyReextractionEventRef & { ordinal: number }>;
  /** Items a high-confidence dedup match folded into an event of another post. */
  linkedToExisting: ApplyReextractionEventRef[];
  /** New events whose mid-confidence match is queued for a moderator. */
  queuedForReview: number;
  /** Items that matched an event a moderator had deleted: not recreated (PRD 3.7). */
  skippedDeleted: number;
  /** Live events of the post that no item matched: untouched. */
  orphans: ApplyReextractionEventRef[];
}

/** AD-40 -- stored in `manual_extraction_jobs.result_data` for a `REEXTRACT_PREVIEW` job. */
export interface ReextractionPreviewResult {
  groupingReason: string | null;
  postStored: boolean;
  rescraped: boolean;
  /** BUG-097 -- images the post lists (cover + slides) and images actually read by the extraction. */
  imagesAvailable: number;
  imagesSent: number;
  events: ReextractionPreviewEvent[];
  /** AD-40 (Apply) -- kept for Apply; nulled once applied. Absent on jobs finished before Apply existed. */
  extracted?: ReextractionExtracted | null;
  /** AD-40 (Apply) -- set once, when a moderator applies this preview. */
  appliedAt?: string | null;
  applied?: ApplyReextractionSummary | null;
}

/** AD-40 (Apply) -- a preview can be applied this long after it finished. */
export const REEXTRACT_APPLY_WINDOW_MS = 30 * 60 * 1000;

/** AD-40 -- the rescrape of a post URL is rate-limited per URL (scraper credit). */
export const REEXTRACT_RESCRAPE_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * BUG-097 -- slides (beyond the cover) a moderator re-extract sends to Gemini. Ingestion keeps its
 * own `MAX_CAROUSEL_IMAGES`; this one is higher because a roundup spreads its events across slides
 * and a moderator preview is a manual, on-demand call.
 */
export const REEXTRACT_MAX_CAROUSEL_IMAGES = 10;

/**
 * GraphQL-safe representation of `PostGroupingReason` (Story 3.6u, AD-30 Rule 11). The DB enum's
 * hyphenated values are not legal GraphQL enum literals, so this mapping function translates each
 * one to its `events.graphql` `PostGroupingReason` enum member. Used by `Event.sourcePosts`'s
 * resolver -- the only consumer of `posts.groupingReason` outside this package.
 */
export type PostGroupingReasonGraphQL = 'SINGLE_EVENT' | 'PROGRAM_LINEUP' | 'DEPENDENT_STAGES' | 'SEPARATE_EVENTS' | 'ROUNDUP';

const POST_GROUPING_REASON_TO_GRAPHQL: Record<PostGroupingReason, PostGroupingReasonGraphQL> = {
  'single-event': 'SINGLE_EVENT',
  'program-lineup': 'PROGRAM_LINEUP',
  'dependent-stages': 'DEPENDENT_STAGES',
  'separate-events': 'SEPARATE_EVENTS',
  roundup: 'ROUNDUP',
};

export function postGroupingReasonToGraphQL(reason: PostGroupingReason): PostGroupingReasonGraphQL {
  return POST_GROUPING_REASON_TO_GRAPHQL[reason];
}

export interface ProcessingJobMessage {
  postId: string;
  accountId: string;
  content: string;
  imageUrl?: string;
  postUrl: string;
  publishedAt: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
  /**
   * Image URLs of every slide in a multi-image (carousel/Sidecar) Instagram post, in slide order
   * (excluding the cover, which is `imageUrl`). Purely an extraction-time input for the AI
   * processing step; never displayed in any UI. Story 3.6l consumes this to build a multi-image
   * Gemini request.
   */
  additionalImageUrls?: string[];
}

export class PostNotFoundError extends Error {
  constructor(message?: string) {
    super(message || 'Post not found');
    this.name = 'PostNotFoundError';
  }
}

export class PostAlreadyExtractedError extends Error {
  constructor(message?: string) {
    super(message || 'Post has already been extracted');
    this.name = 'PostAlreadyExtractedError';
  }
}

/**
 * Story 3.6z (AC3) — thrown by `enqueuePostForProcessing` when a non-stale claim
 * (`posts.queued_for_extraction_at`, within its TTL) already exists for the post, meaning
 * another in-flight attempt (manual or auto) has already claimed it.
 */
export class PostAlreadyQueuedError extends Error {
  constructor(message?: string) {
    super(message || 'Post is already queued for extraction');
    this.name = 'PostAlreadyQueuedError';
  }
}
