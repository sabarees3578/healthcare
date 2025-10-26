// Simple service worker for Web Push notifications
self.addEventListener('install', (e)=> { self.skipWaiting(); });
self.addEventListener('activate', (e)=> { self.clients.claim(); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) { try { data = { body: event.data.text() }; } catch(e2) {} }
  const title = data.title || 'Health Portal Notification';
  const options = { body: data.body || '', icon: data.icon || '/icon.png', badge: data.badge || '/icon.png' };
  event.waitUntil(self.registration.showNotification(title, options));
});
