import { getMessaging, getToken } from 'firebase/messaging';
import { getFirebaseApp } from './firebase-client';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from './graphql-client';
import { ReportSystemErrorDocument } from '../generated/graphql';

function deleteFirebaseDatabase(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }
    const req = window.indexedDB.deleteDatabase('firebase-messaging-database');
    req.onsuccess = () => {
      console.log('Successfully deleted firebase-messaging-database');
      resolve();
    };
    req.onerror = (event) => {
      console.error('Error deleting firebase-messaging-database:', event);
      resolve();
    };
    req.onblocked = () => {
      console.warn('Deletion of firebase-messaging-database was blocked');
      resolve();
    };
  });
}

export async function requestPushPermissionAndRegister(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('Push Notifications: Browser does not support Notifications.');
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Push Notifications: Browser does not support Service Workers.');
      return null;
    }

    const app = getFirebaseApp();
    if (!app) {
      console.warn('Push Notifications: Firebase App client is not initialized.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push Notifications: Permission denied or not granted.');
      return null;
    }

    const apiKeyEncoded = encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '');
    const authDomainEncoded = encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '');
    const projectIdEncoded = encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '');
    const messagingSenderIdEncoded = encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '');
    const appIdEncoded = encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '');

    const swUrl = `/firebase-messaging-sw.js?apiKey=${apiKeyEncoded}&authDomain=${authDomainEncoded}&projectId=${projectIdEncoded}&messagingSenderId=${messagingSenderIdEncoded}&appId=${appIdEncoded}`;

    const registerAndGetToken = async (): Promise<string | null> => {
      const serviceWorkerRegistration = await navigator.serviceWorker.register(swUrl);

      try {
        await serviceWorkerRegistration.update();
      } catch (err) {
        console.error('Service worker update failed:', err);
      }

      const messaging = getMessaging(app);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        console.warn('Push Notifications: NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing.');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      return token || null;
    };

    try {
      return await registerAndGetToken();
    } catch (error: any) {
      if (error && error.name === 'VersionError') {
        console.warn('IndexedDB VersionError detected. Initiating self-healing...');

        // 1. Delete the database
        await deleteFirebaseDatabase();

        // 2. Retry register exactly once
        let token: string | null = null;
        let retrySucceeded = false;
        try {
          token = await registerAndGetToken();
          retrySucceeded = !!token;
        } catch (retryError: any) {
          console.error('Retry after VersionError self-healing failed:', retryError);
          retrySucceeded = false;
        }

        // 3. Capture PostHog analytics event
        try {
          capturePostHogEvent('push_notifications_sw_error', {
            errorName: 'VersionError',
            retrySucceeded,
          });
        } catch (analyticsError) {
          console.error('Failed to capture PostHog analytics event:', analyticsError);
        }

        // 4. Report system error to backend via fire-and-forget GraphQL request
        const retryOutcome = retrySucceeded ? 'retry-success' : 'retry-failed';
        try {
          graphqlClient.request(ReportSystemErrorDocument, {
            input: {
              source: 'service-worker',
              message: error.message || 'FCM IndexedDB VersionError occurred',
              context: `retryOutcome: ${retryOutcome}, error: ${error.name}`,
            },
          }).catch((gqlErr) => {
            console.error('Failed to send system error report via GraphQL request:', gqlErr);
          });
        } catch (gqlErr) {
          console.error('Failed to send system error report via GraphQL:', gqlErr);
        }

        return token;
      } else {
        // Fall back to existing generic catch
        throw error;
      }
    }
  } catch (error) {
    console.error('Error during push notification registration:', error);
    return null;
  }
}
