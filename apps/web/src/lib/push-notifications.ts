import { getMessaging, getToken } from 'firebase/messaging';
import { getFirebaseApp } from './firebase-client';

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

    const serviceWorkerRegistration = await navigator.serviceWorker.register(swUrl);

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
  } catch (error) {
    console.error('Error during push notification registration:', error);
    return null;
  }
}
