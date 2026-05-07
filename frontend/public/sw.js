'use strict';

// ── Lifecycle ───────────────────────────────────────────────────────────────
// skipWaiting + claim so the new SW takes control immediately on update.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ── Push event ──────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Habit Tracker',
    body: '🌱 Не забудьте отметить привычки сегодня!',
    url: '/',
  };

  if (event.data) {
    try {
      Object.assign(payload, event.data.json());
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    // 'tag' collapses multiple notifications into one (replaces on re-fire)
    tag: 'habit-tracker-reminder',
    renotify: true,
    data: { url: payload.url },
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ── Notification click ──────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if it's already open
        for (const client of clientList) {
          try {
            const clientPath = new URL(client.url).pathname;
            if (clientPath === targetUrl && 'focus' in client) {
              return client.focus();
            }
          } catch {
            // ignore URL parse errors
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl);
      })
  );
});
