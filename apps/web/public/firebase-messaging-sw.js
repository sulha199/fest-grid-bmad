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

// Story 10.13 (notify when a job finishes): a click on a notification that carries `data.path` opens that page of this app.
// Only a same-origin path is followed ("/jobs", "/jobs/<id>"); anything else (an absolute URL, a protocol-relative "//host",
// a script scheme, a non-string) is ignored, so a push can never send the user to another site. The path has no locale: the
// next-intl middleware redirects "/jobs/<id>" to the user's locale route. A notification with no such path (the new-event push)
// is left to the Firebase SDK's own click handling, exactly as before.
function sameOriginUrlFromPath(path) {
  if (typeof path !== 'string' || path.charAt(0) !== '/' || path.charAt(1) === '/' || path.indexOf('\\') !== -1) return null;
  try {
    const url = new URL(path, self.location.origin);
    return url.origin === self.location.origin ? url.href : null;
  } catch (e) {
    return null;
  }
}

function notificationPath(data) {
  if (!data) return undefined;
  if (typeof data.path === 'string') return data.path;
  // A notification the Firebase SDK displayed itself keeps the push's data map under FCM_MSG.
  return data.FCM_MSG && data.FCM_MSG.data ? data.FCM_MSG.data.path : undefined;
}

self.addEventListener('notificationclick', (event) => {
  const target = sameOriginUrlFromPath(notificationPath(event.notification && event.notification.data));
  if (!target) return;
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url && w.url.indexOf(self.location.origin) === 0 && typeof w.focus === 'function');
      if (!open) return self.clients.openWindow(target);
      return open
        .focus()
        .then((focused) => (focused && typeof focused.navigate === 'function' ? focused.navigate(target) : undefined))
        .catch(() => self.clients.openWindow(target));
    })
  );
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
