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
}

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
