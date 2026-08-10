import { db } from '../../db/client.js';
import { events, schedules } from '@festgrid/database';
import { ExtractedEventMessage, buildEventInsertValues } from '@festgrid/domain';
import { sendEventNotificationsSeam } from '../notifications/send-event-notifications.js';

export async function processIngestionJob(message: ExtractedEventMessage): Promise<{ inserted: boolean }> {
  const { event, schedules: scheduleValues } = buildEventInsertValues(message);

  let insertedEvent: any = null;

  const result = await db.transaction(async (tx) => {
    const insertedEvents = await tx
      .insert(events)
      .values(event)
      .onConflictDoNothing({ target: [events.postId] })
      .returning();

    if (insertedEvents.length === 0) {
      console.log(`Skipped duplicate ingestion for postId: ${message.postId}`);
      return { inserted: false };
    }

    insertedEvent = insertedEvents[0];

    if (scheduleValues.length > 0) {
      const schedulesToInsert = scheduleValues.map((s) => ({
        ...s,
        eventId: insertedEvent.id,
      }));

      await tx.insert(schedules).values(schedulesToInsert);
    }

    return { inserted: true };
  });

  if (result.inserted && insertedEvent && message.sourceSocialMediaAccountId) {
    // Non-blocking trigger of sendEventNotifications after transaction commits
    sendEventNotificationsSeam(
      {
        id: insertedEvent.id,
        slug: insertedEvent.slug,
        name: insertedEvent.eventName,
        description: insertedEvent.description || '',
      },
      message.sourceSocialMediaAccountId
    ).catch((err) => {
      console.error('[processIngestionJob] Notification background dispatch failed:', err);
    });
  }

  return { inserted: result.inserted };
}
