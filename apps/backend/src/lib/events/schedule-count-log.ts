// TEMPORARY diagnostic (remove once the cause of the loss is found; a few info lines per event, no flag).
// Log-only counters for "the AI extracted N schedules but fewer got stored" (prod 2026-11-09:
// post b0fdae96, audit said 10 schedules for one event, 2 stored; 48 of 2,890 recent posts show the same
// shape, and neither the model response nor the queue message is persisted). The three hand-off points are
// logged with one greppable key=value line each, so the first pair of lines that disagree names the step
// that drops schedules:
//   extraction-schedules  (AI Lambda, per event)   model payload count vs the built message count
//   enqueue               (AI Lambda, per event)   schedules in the message actually sent, and its body size
//   ingest-schedules      (ingestor, per event)    schedules received in the message vs sent to the insert vs rows inserted
// Join the AI-processor lines by post + name (both truncated the same way): the extraction line is keyed by the
// model's event order and the later lines by ordinal, which is re-sorted by date.
// Routine lines use console.info on purpose (several test files assert exact console.log/console.warn
// counts, same convention as logFaceBlurThumbnailOutcome). Only a received/sent/inserted mismatch warns. A logging
// failure must never affect extraction or ingestion, so every emitter swallows its own errors.

const NAME_MAX_LENGTH = 60;

function cleanName(name: string | undefined | null): string {
  const flat = (name ?? '').replace(/\s+/g, ' ').trim();
  const clipped = flat.length > NAME_MAX_LENGTH ? `${flat.slice(0, NAME_MAX_LENGTH)}...` : flat;
  // Quotes would break key=value parsing in a Logs Insights query.
  return clipped.replace(/"/g, "'");
}

function safely(emit: () => void): void {
  try {
    emit();
  } catch {
    // Purely diagnostic: never let a logging problem change what extraction or ingestion does.
  }
}

export function logExtractionScheduleCounts(input: {
  postId: string;
  eventIndex: number;
  eventName: string;
  modelSchedules: number;
  messageSchedules: number;
}): void {
  safely(() =>
    console.info(
      `[processAiJob] extraction-schedules post=${input.postId} eventIndex=${input.eventIndex} ` +
        `name="${cleanName(input.eventName)}" modelSchedules=${input.modelSchedules} messageSchedules=${input.messageSchedules}`
    )
  );
}

export function logEnqueueScheduleCounts(input: {
  postId: string;
  ordinal: number;
  eventName: string;
  schedules: number;
  bodyBytes: number;
}): void {
  safely(() =>
    console.info(
      `[processAiJob] enqueue post=${input.postId} ordinal=${input.ordinal} name="${cleanName(input.eventName)}" ` +
        `schedules=${input.schedules} bodyBytes=${input.bodyBytes}`
    )
  );
}

export function logEnqueueTotals(input: {
  postId: string;
  events: number;
  modelSchedules: number;
  enqueuedSchedules: number;
}): void {
  safely(() =>
    console.info(
      `[processAiJob] enqueue-totals post=${input.postId} events=${input.events} ` +
        `modelSchedules=${input.modelSchedules} enqueuedSchedules=${input.enqueuedSchedules}`
    )
  );
}

export type IngestScheduleCountInput =
  | { path: 'insert'; postId: string; ordinal: number; received: number; sent: number; inserted: number }
  | { path: 'enrich'; postId: string; ordinal: number; received: number; incoming: number; final: number };

/**
 * One line per ingested event. On the insert path a received/sent/inserted mismatch also warns (the one
 * non-routine line). The enrich path merges into an existing event, so its final count legitimately
 * differs from the incoming one; it is only informational there.
 */
export function logIngestScheduleCounts(input: IngestScheduleCountInput): void {
  safely(() => {
    if (input.path === 'insert') {
      console.info(
        `[ingestor] ingest-schedules path=insert post=${input.postId} ordinal=${input.ordinal} received=${input.received} sent=${input.sent} inserted=${input.inserted}`
      );
      // Any difference is a loss: the message's schedules map 1:1 to the rows sent, and those to the rows stored.
      if (input.received !== input.sent || input.inserted !== input.sent) {
        console.warn(
          `[ingestor] schedule-count-mismatch post=${input.postId} ordinal=${input.ordinal} received=${input.received} sent=${input.sent} inserted=${input.inserted}`
        );
      }
      return;
    }
    console.info(
      `[ingestor] ingest-schedules path=enrich post=${input.postId} ordinal=${input.ordinal} received=${input.received} incoming=${input.incoming} final=${input.final}`
    );
  });
}
