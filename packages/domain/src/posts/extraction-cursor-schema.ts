import { z } from "zod";
import { EXTRACTION_CURSOR_VERSION, type ExtractionCursor } from "./extraction-cursor.js";
import { POST_GROUPING_REASONS } from "./types.js";

/**
 * AD-47 Rule 1: the cursor is read back from a jsonb column and from a queue message, so it is validated rather than
 * trusted. A value that does not parse is treated as no cursor by the caller, never partially used.
 */
const nonNegativeInt = z.number().int().nonnegative();

export const extractionCursorSchema = z
  .object({
    version: z.literal(EXTRACTION_CURSOR_VERSION),
    postId: z.string().min(1),
    stepCount: nonNegativeInt,
    leaseNonce: z.string().min(1),
    nextSlide: nonNegativeInt,
    totalImages: nonNegativeInt,
    unreadAtStart: nonNegativeInt,
    unreadImageUrls: z.array(z.string().min(1)),
    nextOrdinal: nonNegativeInt,
    foundKeys: z.array(z.string()),
    groupingReason: z.enum(POST_GROUPING_REASONS).nullable(),
    followUpMade: z.boolean(),
    emptySteps: nonNegativeInt,
    windowSize: nonNegativeInt,
    requestsMade: nonNegativeInt,
    resumeAttempts: nonNegativeInt,
    rescrapeCount: nonNegativeInt,
    lastRescrapeAt: z.string().nullable(),
    itemsPerSlide: z.number().positive().nullable(),
    claimedItemCount: nonNegativeInt.nullable(),
  })
  .strict();

/** The cursor, or `null` for anything that is not a well-formed current-version cursor. */
export function parseExtractionCursor(value: unknown): ExtractionCursor | null {
  const parsed = extractionCursorSchema.safeParse(value);
  return parsed.success ? (parsed.data as ExtractionCursor) : null;
}
