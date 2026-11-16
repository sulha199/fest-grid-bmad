import { randomUUID } from 'node:crypto';
import {
  EXTRACTION_CURSOR_VERSION,
  type ExtractionCursor,
  type PostGroupingReason,
  type ProcessingJobMessage,
} from '@festgrid/domain/posts';
import { loadBackendEnv } from '../../env.js';
import { sendSqsMessage } from '../aws/send-sqs-message.js';

// AD-47 -- the pieces of a stepped extraction that the first request and the step handler share: the step message and
// its queue send, and the first cursor. No Gemini, no database here.

/** The pause before a step runs (AD-51 Rule 3: serial steps with a short delay between them space a post's requests). */
export const STEP_DELAY_SECONDS = 10;

export interface StepMessageBase {
  postId: string;
  accountId: string;
  postUrl: string;
  publishedAt: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
}

/** A step message: the post's identity plus the cursor. It never carries the caption or an image (AD-40, AD-47 Rule 1). */
export function buildStepMessage(base: StepMessageBase, cursor: ExtractionCursor): ProcessingJobMessage {
  return {
    postId: base.postId,
    accountId: base.accountId,
    content: '',
    postUrl: base.postUrl,
    publishedAt: base.publishedAt,
    ...(base.ownerDisplayName !== undefined ? { ownerDisplayName: base.ownerDisplayName } : {}),
    ...(base.ownerUsername !== undefined ? { ownerUsername: base.ownerUsername } : {}),
    cursor,
  };
}

/** Sends a step message to the AI processing queue after the inter-step delay. */
export async function enqueueStepMessage(message: ProcessingJobMessage): Promise<void> {
  const queueUrl = loadBackendEnv().aiProcessingQueueUrl;
  if (!queueUrl) {
    throw new Error('AI_PROCESSING_QUEUE_URL is not configured; cannot enqueue the next extraction step');
  }
  await sendSqsMessage(queueUrl, JSON.stringify(message), { delaySeconds: STEP_DELAY_SECONDS });
}

export interface FirstCursorInput {
  postId: string;
  /** Total images of the post (cover included) and how many the first window covered. */
  totalImages: number;
  firstWindowImageCount: number;
  unreadImageUrls: string[];
  /** Events the first request produced (after the per-call cap), the next free ordinal and their dedupe keys. */
  eventKeys: string[];
  nextOrdinal: number;
  groupingReason: PostGroupingReason | null;
  windowSize: number;
  itemsPerSlide: number | null;
  claimedItemCount: number | null;
}

/** The cursor a chain starts with, right after the first request (AD-47 Rule 1, AD-51 Rule 1). */
export function buildFirstCursor(input: FirstCursorInput): ExtractionCursor {
  return {
    version: EXTRACTION_CURSOR_VERSION,
    postId: input.postId,
    stepCount: 0,
    leaseNonce: randomUUID(),
    nextSlide: input.firstWindowImageCount,
    totalImages: input.totalImages,
    unreadAtStart: input.unreadImageUrls.length,
    unreadImageUrls: input.unreadImageUrls,
    nextOrdinal: input.nextOrdinal,
    foundKeys: input.eventKeys,
    groupingReason: input.groupingReason,
    followUpMade: false,
    emptySteps: input.eventKeys.length === 0 ? 1 : 0,
    windowSize: input.windowSize,
    requestsMade: 0,
    resumeAttempts: 0,
    rescrapeCount: 0,
    lastRescrapeAt: null,
    itemsPerSlide: input.itemsPerSlide,
    claimedItemCount: input.claimedItemCount,
  };
}
