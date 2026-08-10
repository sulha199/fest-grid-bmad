import { db } from '../../db/client.js';
import { events, schedules } from '@festgrid/database';
import { ExtractedEventMessage, buildEventInsertValues } from '@festgrid/domain';

export async function processIngestionJob(message: ExtractedEventMessage): Promise<{ inserted: boolean }> {
  const { event, schedules: scheduleValues } = buildEventInsertValues(message);

  return await db.transaction(async (tx) => {
    const insertedEvents = await tx
      .insert(events)
      .values(event)
      .onConflictDoNothing({ target: [events.postId] })
      .returning();

    if (insertedEvents.length === 0) {
      console.log(`Skipped duplicate ingestion for postId: ${message.postId}`);
      return { inserted: false };
    }

    const insertedEvent = insertedEvents[0];

    if (scheduleValues.length > 0) {
      const schedulesToInsert = scheduleValues.map((s) => ({
        ...s,
        eventId: insertedEvent.id,
      }));

      await tx.insert(schedules).values(schedulesToInsert);
    }

    return { inserted: true };
  });
}
