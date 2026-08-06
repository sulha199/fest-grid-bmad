import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { loadBackendEnv } from '../env';

let adminApp: App | null = null;

export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }

  const env = loadBackendEnv();
  const { firebaseProjectId, firebaseClientEmail, firebasePrivateKey } = env;

  if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
    throw new Error(
      'Firebase Admin initialization failed: Missing required Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  adminApp = initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });

  return adminApp;
}

export function buildPushMessage(
  deviceToken: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Message {
  const message: Message = {
    token: deviceToken,
    notification: {
      title: notification.title,
      body: notification.body,
    },
  };

  if (data && Object.keys(data).length > 0) {
    message.data = data;
  }

  return message;
}

export async function sendPushNotification(
  deviceToken: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<string> {
  const app = getAdminApp();
  const message = buildPushMessage(deviceToken, notification, data);
  return getMessaging(app).send(message);
}
