// Firebase Cloud Messaging Service Worker (compat version)
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

// Unconditional lifecycle control
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Extract config from service worker script URL query parameters (passed during registration if dynamic config is needed),
// or fall back to standard inlined values.
const urlParams = new URL(location).searchParams;

const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || '',
  authDomain: urlParams.get('authDomain') || '',
  projectId: urlParams.get('projectId') || '',
  messagingSenderId: urlParams.get('messagingSenderId') || '',
  appId: urlParams.get('appId') || '',
};

// Initialize Firebase App
if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // Background message handler
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification?.title || 'FestGrid Notification';
    const notificationOptions = {
      body: payload.notification?.body || 'FCM background message received.',
      // Story 0.38 (Task 3.2b, readiness correction 2026-09-30) — repointed
      // from the non-existent '/icon-192x192.png' to the real, checked-in
      // icon this story adds (apps/web/public/icons/icon-192.png).
      icon: payload.notification?.image || '/icons/icon-192.png',
      data: payload.data,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[firebase-messaging-sw.js] Firebase Config is incomplete. SW initialized in idle mode.');
}
