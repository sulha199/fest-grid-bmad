import { getAdminApp } from '../firebase-admin.js';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { buildFcmPayload } from '@festgrid/domain';
import { getSubscribersForNotification } from './get-subscribers-for-notification.js';
import { db } from '../../db/client.js';
import { fcmTokens } from '@festgrid/database';
import { inArray } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';
import { sendTemplatedEmail } from '../email/adapter.js';

async function reportErrorSilently(source: string, message: string, context: string): Promise<void> {
  const env = loadBackendEnv();
  if (env.systemErrorAlertEmail) {
    try {
      await sendTemplatedEmail('SYSTEM_ERROR_ALERT', env.systemErrorAlertEmail, {
        source,
        message,
        context,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[reportErrorSilently] failed to send alert email', err);
    }
  } else {
    console.error('[reportErrorSilently] SYSTEM_ERROR_ALERT_EMAIL not configured; error not alerted', { source, message, context });
  }
}

/**
 * What a send tells its caller. `firebaseInitFailed` is true only when Firebase could not be
 * initialised, i.e. the send failed **before any FCM request was made**: nothing was delivered or even
 * attempted, so the caller may release its claim on the event (AD-30 Rule 10, amended 2026-10-21).
 * Every other outcome, including a failed request, keeps the claim and is not retried.
 */
export interface SendEventNotificationsResult {
  firebaseInitFailed: boolean;
}

type SendEventNotificationsFn = (
  event: { id: string; slug: string; name: string; description: string },
  sourceAccountId: string
) => Promise<SendEventNotificationsResult | void>;

export let sendEventNotificationsSeam: SendEventNotificationsFn = sendEventNotifications;

export function setSendEventNotificationsSeam(fn: SendEventNotificationsFn) {
  sendEventNotificationsSeam = fn;
}

// Test seam for the one place Firebase is initialised, so an initialisation failure can be simulated.
export let getMessagingClient = (): Messaging => getMessaging(getAdminApp());

export function setGetMessagingClient(fn: typeof getMessagingClient) {
  getMessagingClient = fn;
}

export async function sendEventNotifications(
  event: { id: string; slug: string; name: string; description: string },
  sourceAccountId: string
): Promise<SendEventNotificationsResult> {
  try {
    const tokens = await getSubscribersForNotification(sourceAccountId);
    if (tokens.length === 0) {
      console.log(`[sendEventNotifications] No subscribers with active device tokens found for sourceAccountId: ${sourceAccountId}`);
      return { firebaseInitFailed: false };
    }

    // Initialise Firebase once, before any request. A failure here (missing or invalid credentials) means
    // nothing was sent or attempted, which is the one case the caller's claim on the event is released
    // for; it is reported by e-mail like any other send failure (BUG-073).
    let messaging: Messaging;
    try {
      messaging = getMessagingClient();
    } catch (initError: any) {
      console.error('[sendEventNotifications] Firebase initialisation failed, nothing was sent:', initError);
      await reportErrorSilently(
        'sendEventNotifications - Firebase initialisation',
        initError.message || String(initError),
        JSON.stringify({ event, sourceAccountId })
      );
      return { firebaseInitFailed: true };
    }

    // Batch tokens in groups of 500 (FCM limit)
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const payload = buildFcmPayload(event, batch);

      try {
        const result = await messaging.sendEachForMulticast(payload);

        const tokensToDelete: string[] = [];

        result.responses.forEach((res, index) => {
          if (!res.success && res.error) {
            const code = res.error.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              tokensToDelete.push(batch[index]);
            }
          }
        });

        if (tokensToDelete.length > 0) {
          console.log(`[sendEventNotifications] Deleting ${tokensToDelete.length} invalid or inactive device tokens from DB`);
          await db.delete(fcmTokens).where(inArray(fcmTokens.token, tokensToDelete));
        }
      } catch (batchError: any) {
        console.error('[sendEventNotifications] FCM batch dispatch failed:', batchError);
        await reportErrorSilently(
          'sendEventNotifications - Batch Dispatch',
          batchError.message || String(batchError),
          JSON.stringify({ event, sourceAccountId, batchSize: batch.length })
        );
      }
    }
    return { firebaseInitFailed: false };
  } catch (error: any) {
    console.error('[sendEventNotifications] Notification process failed:', error);
    await reportErrorSilently(
      'sendEventNotifications - Global Process',
      error.message || String(error),
      JSON.stringify({ event, sourceAccountId })
    );
    return { firebaseInitFailed: false };
  }
}
