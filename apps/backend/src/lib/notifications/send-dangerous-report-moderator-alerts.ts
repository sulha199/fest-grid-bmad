import * as emailAdapter from '../email/adapter.js';
import { notifyAllModerators } from './notify-all-moderators.js';

// Moderator lookup, fan-out, the review URL, escaping and the throttle all live in `notifyAllModerators`
// (Story 0.i1a, AD-54). The throttle entity is the event id, so repeated "dangerous" reports of one event in
// the cooldown send one mail and a different event sends its own; without an id it falls back to the event name.
// The helper never throws, so a mail failure can never change the report resolver's result.
export async function sendDangerousReportModeratorAlerts(
  eventName: string,
  eventId?: string,
  deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
): Promise<void> {
  await notifyAllModerators(
    'DANGEROUS_EVENT_MODERATOR_ALERT',
    { eventName },
    eventId === undefined ? {} : { entityKey: eventId },
    { sendTemplatedEmail: deps.sendTemplatedEmail }
  );
}
