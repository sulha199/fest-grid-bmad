import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

let firebaseApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseApp) {
    return firebaseApp;
  }

  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
    return firebaseApp;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    console.warn(
      'Firebase Client registration skipped: Missing some or all NEXT_PUBLIC_FIREBASE_* environment variables.'
    );
    return null;
  }

  try {
    firebaseApp = initializeApp({
      apiKey,
      authDomain,
      projectId,
      messagingSenderId,
      appId,
    });
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase client app:', error);
    return null;
  }
}
