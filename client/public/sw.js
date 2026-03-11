// EVGreen Service Worker v6.0.0 - Minimal: Push notifications + offline fallback only
// CRITICAL: This SW does NOT cache any JS, CSS, or HTML to prevent stale content issues.
// The browser's native HTTP cache handles asset caching efficiently.
const SW_VERSION = 'v6';

// ============================================
// INSTALLATION - Clean slate approach
// ============================================
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// ============================================
// ACTIVATION - Delete ALL old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating - clearing all old caches...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          console.log(`[SW ${SW_VERSION}] Deleting cache: ${name}`);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log(`[SW ${SW_VERSION}] All caches cleared, claiming clients...`);
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH - Minimal interception
// Only intercept navigation requests for offline fallback
// Let the browser handle everything else natively
// ============================================
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline: return a simple offline page
        return new Response(
          `<!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>EVGreen - Sin conexión</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0a0a0a; color: #fff; 
                display: flex; align-items: center; justify-content: center;
                min-height: 100vh; padding: 24px; text-align: center;
              }
              .container { max-width: 360px; }
              .icon { font-size: 48px; margin-bottom: 16px; }
              h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
              p { font-size: 14px; color: #888; margin-bottom: 24px; line-height: 1.5; }
              button {
                padding: 12px 32px; border: none; border-radius: 12px;
                background: linear-gradient(135deg, #22c55e, #06b6d4);
                color: white; font-size: 14px; font-weight: 600;
                cursor: pointer; width: 100%;
              }
              button:active { opacity: 0.8; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">📡</div>
              <h1>Sin conexión a internet</h1>
              <p>Verifica tu conexión WiFi o datos móviles e intenta de nuevo.</p>
              <button onclick="location.reload()">Reintentar</button>
            </div>
          </body>
          </html>`,
          { 
            status: 503, 
            headers: { 'Content-Type': 'text/html; charset=utf-8' } 
          }
        );
      })
    );
    return;
  }

  // For ALL other requests (JS, CSS, images, API calls):
  // Do NOT intercept. Let the browser handle them natively.
  // This prevents stale cache issues that cause the "Cargando..." freeze.
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'EVGreen', body: event.data.text() };
  }

  const title = data.notification?.title || data.title || 'EVGreen';
  const body = data.notification?.body || data.body || 'Nueva notificación de EVGreen';
  const image = data.notification?.image || data.notification?.imageUrl || data.imageUrl;
  const clickAction = data.data?.clickAction || data.data?.actionUrl || data.fcmOptions?.link || data.url || '/';

  const options = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.data?.type || 'evgreen-notification',
    renotify: true,
    requireInteraction: data.data?.type === 'low_balance' || data.data?.type === 'charging_error',
    data: {
      url: clickAction,
      type: data.data?.type || 'general',
      ...data.data,
    },
    actions: data.actions || [],
  };

  if (image) {
    options.image = image;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            clientList.forEach((client) => {
              client.postMessage({
                type: 'PUSH_NOTIFICATION',
                title,
                body,
                data: data.data || {},
              });
            });
          });
      })
  );
});

// ============================================
// NOTIFICATION CLICK HANDLING
// ============================================
const VALID_ROUTES = [
  '/', '/map', '/wallet', '/history', '/profile', '/reservations',
  '/support', '/assistant', '/scan', '/start-charge', '/overstay',
  '/charging-waiting', '/charging-monitor', '/subscription',
  '/settings/notifications', '/settings/personal', '/settings/vehicles',
  '/settings/payment', '/settings/config', '/vehicles',
  '/investor', '/investor/stations', '/investor/transactions',
  '/investor/reports', '/investor/settings', '/investor/earnings',
  '/admin', '/soc-accuracy'
];

const VALID_DYNAMIC_ROUTES = [
  /^\/station\/\d+$/,
  /^\/charging\/\d+$/,
  /^\/charging-summary\/\d+$/,
  /^\/c\/.+$/,
];

function isValidRoute(path) {
  if (VALID_ROUTES.includes(path)) return true;
  return VALID_DYNAMIC_ROUTES.some(regex => regex.test(path));
}

function getRouteForNotificationType(type) {
  const typeRouteMap = {
    'test': '/settings/notifications',
    'charging_complete': '/charging-monitor',
    'charging_started': '/charging-monitor',
    'charging_error': '/charging-monitor',
    'overstay_alert': '/overstay',
    'low_balance': '/wallet',
    'payment_received': '/wallet',
    'payment_failed': '/wallet',
    'reservation_reminder': '/reservations',
    'reservation_confirmed': '/reservations',
    'station_available': '/map',
    'system_alert': '/settings/notifications',
    'general': '/',
  };
  return typeRouteMap[type] || '/';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  let targetPath = notifData.url || notifData.actionUrl || notifData.clickAction || '';
  
  try {
    if (targetPath.startsWith('http')) {
      targetPath = new URL(targetPath).pathname;
    }
  } catch (e) {
    targetPath = '/';
  }

  if (!targetPath || !isValidRoute(targetPath)) {
    const notifType = notifData.type || 'general';
    targetPath = getRouteForNotificationType(notifType);
  }

  const urlToOpen = self.location.origin + targetPath;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.navigate(urlToOpen).then(() => client.focus());
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Clear cache command - delete everything
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// ============================================
// BACKGROUND SYNC (placeholder)
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-charges') {
    console.log(`[SW ${SW_VERSION}] Background sync triggered`);
  }
});
