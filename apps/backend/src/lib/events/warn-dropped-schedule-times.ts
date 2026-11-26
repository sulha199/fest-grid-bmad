import { listDroppedScheduleTimes } from '@festgrid/domain/events';

/**
 * Logs one `console.warn` for an extracted schedule time that was not a valid time and was stored
 * as null (see `normalizeExtractedTime`). Carries the post id, schedule position, field name and
 * the raw time string only: never a caption, event text or account identifier. Never throws.
 */
export function warnDroppedScheduleTimes(
  message: { postId: string; schedules?: ReadonlyArray<{ eventStartTime?: string | null; eventEndTime?: string | null }> | null }
): void {
  for (const dropped of listDroppedScheduleTimes(message.schedules)) {
    console.warn(
      `Dropped unparseable schedule time (stored as null): postId=${message.postId} scheduleIndex=${dropped.scheduleIndex} field=${dropped.field} value=${JSON.stringify(dropped.value)}`
    );
  }
}
