import { listDroppedScheduleTimes } from '@festgrid/domain/events';

// The value is model output and unbounded: when it is not a time it can be a stretch of caption text.
const MAX_LOGGED_VALUE_LENGTH = 40;

/**
 * Logs one `console.warn` for an extracted schedule time that was not a valid time and was stored
 * as null (see `normalizeExtractedTime`). Carries the post id, schedule position, field name and
 * the raw time string (cut to 40 characters) only: never a caption, event text or account identifier. Never throws.
 */
export function warnDroppedScheduleTimes(
  message: { postId: string; schedules?: ReadonlyArray<{ eventStartTime?: string | null; eventEndTime?: string | null }> | null }
): void {
  for (const dropped of listDroppedScheduleTimes(message.schedules)) {
    console.warn(
      `Dropped unparseable schedule time (stored as null): postId=${message.postId} scheduleIndex=${dropped.scheduleIndex} field=${dropped.field} value=${JSON.stringify(dropped.value.slice(0, MAX_LOGGED_VALUE_LENGTH))}`
    );
  }
}
