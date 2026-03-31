// EVGreen Service Worker v8.0.0 - Push notifications fix + offline/503 recovery
// CRITICAL: This SW does NOT cache any JS, CSS, or HTML to prevent stale content issues.
// The browser's native HTTP cache handles asset caching efficiently.
// v8: Fixed push notifications showing as generic Chrome notifications without title/body
const SW_VERSION = 'v8';

// ============================================
// INSTALLATION - Clean slate approach
// ============================================
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
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
// RECOVERY HTML - Shown when server returns 503 or is unreachable
// ============================================
function getRecoveryHTML(reason) {
  const isOffline = reason === 'offline';
  const icon = isOffline ? '📡' : '🔧';
  const title = isOffline ? 'Sin conexión a internet' : 'Servicio en mantenimiento';
  const message = isOffline 
    ? 'Verifica tu conexión WiFi o datos móviles e intenta de nuevo.'
    : 'El servidor está reiniciándose. Esto suele tomar menos de 1 minuto. La página se recargará automáticamente.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0a0a0a">
  <title>EVGreen</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a; color: #fff; 
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; min-height: 100dvh; padding: 24px; text-align: center;
    }
    .container { max-width: 360px; width: 100%; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
    p { font-size: 14px; color: #888; margin-bottom: 24px; line-height: 1.5; }
    .btn-primary {
      padding: 14px 32px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #22c55e, #06b6d4);
      color: white; font-size: 14px; font-weight: 600;
      cursor: pointer; width: 100%; margin-bottom: 12px;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-primary:active { opacity: 0.8; transform: scale(0.98); }
    .btn-secondary {
      padding: 12px 32px; border: 1px solid #333; border-radius: 12px;
      background: transparent; color: #888; font-size: 13px;
      cursor: pointer; width: 100%;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-secondary:active { opacity: 0.8; }
    .status { font-size: 12px; color: #555; margin-top: 20px; }
    .spinner {
      display: none; width: 24px; height: 24px;
      border: 3px solid #333; border-top: 3px solid #22c55e;
      border-radius: 50%; animation: spin 1s linear infinite;
      margin: 16px auto 8px;
    }
    .auto-retry .spinner { display: block; }
    .auto-retry .status-text { display: block; }
    .status-text { display: none; font-size: 12px; color: #22c55e; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container" id="main">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <button class="btn-primary" onclick="retryNow()">Reintentar</button>
    <button class="btn-secondary" onclick="clearAndReload()">Limpiar caché y recargar</button>
    <div class="spinner" id="spinner"></div>
    <div class="status-text" id="statusText">Reintentando automáticamente...</div>
    <div class="status" id="status">Verificando conexión...</div>
  </div>
  <script>
    var retryCount = 0;
    var maxRetries = 60;
    var retryInterval = ${isOffline ? '5000' : '10000'};
    var statusEl = document.getElementById('status');
    var mainEl = document.getElementById('main');

    function updateStatus(msg) {
      statusEl.textContent = msg;
    }

    function retryNow() {
      updateStatus('Recargando...');
      window.location.reload();
    }

    function clearAndReload() {
      updateStatus('Limpiando caché...');
      if ('caches' in window) {
        caches.keys().then(function(names) {
          return Promise.all(names.map(function(n) { return caches.delete(n); }));
        }).then(function() {
          window.location.reload();
        }).catch(function() {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }

    // Auto-retry: check if server is back
    function autoRetry() {
      if (retryCount >= maxRetries) {
        updateStatus('El servidor no responde. Intenta más tarde.');
        return;
      }
      retryCount++;
      mainEl.classList.add('auto-retry');
      updateStatus('Intento ' + retryCount + '/' + maxRetries + '...');

      fetch('/api/health', { cache: 'no-store' })
        .then(function(resp) {
          if (resp.ok) {
            updateStatus('Servidor disponible. Recargando...');
            setTimeout(function() { window.location.reload(); }, 500);
          } else {
            updateStatus('Servidor aún no disponible (HTTP ' + resp.status + '). Reintentando en ' + (retryInterval/1000) + 's...');
            setTimeout(autoRetry, retryInterval);
          }
        })
        .catch(function() {
          updateStatus('Sin respuesta del servidor. Reintentando en ' + (retryInterval/1000) + 's...');
          setTimeout(autoRetry, retryInterval);
        });
    }

    // Start auto-retry after 3 seconds
    setTimeout(autoRetry, 3000);

    // Also retry when connection comes back
    window.addEventListener('online', function() {
      updateStatus('Conexión detectada. Verificando servidor...');
      setTimeout(autoRetry, 1000);
    });
  </script>
</body>
</html>`;
}

// ============================================
// FETCH - Handle navigation with 503 detection
// ============================================
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // CRITICAL: Detect 503 "Service Disabled" from hosting platform
          // When hosting disables the service, it returns 503 with its own HTML
          // which is NOT our app - this causes a blank/broken page
          if (response.status === 503 || response.status === 502) {
            console.warn(`[SW ${SW_VERSION}] Server returned ${response.status} - showing recovery UI`);
            return new Response(
              getRecoveryHTML('maintenance'),
              { 
                status: 200, // Return 200 so browser renders it properly
                headers: { 
                  'Content-Type': 'text/html; charset=utf-8',
                  'Cache-Control': 'no-store, no-cache'
                } 
              }
            );
          }
          return response;
        })
        .catch(() => {
          // Network error (offline)
          console.warn(`[SW ${SW_VERSION}] Network error - showing offline UI`);
          return new Response(
            getRecoveryHTML('offline'),
            { 
              status: 200,
              headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache'
              } 
            }
          );
        })
    );
    return;
  }

  // For ALL other requests (JS, CSS, images, API calls):
  // Do NOT intercept. Let the browser handle them natively.
});

// ============================================
// PUSH NOTIFICATIONS
// v8: Enhanced payload extraction to handle all FCM message formats
// FCM can deliver data in multiple nested structures depending on
// foreground/background state and platform (webpush vs generic).
// This handler normalizes all formats into a consistent notification.
// ============================================
self.addEventListener('push', (event) => {
  console.log(`[SW ${SW_VERSION}] Push event received`);
  
  if (!event.data) {
    console.warn(`[SW ${SW_VERSION}] Push event has no data, ignoring`);
    return;
  }

  let rawData;
  try {
    rawData = event.data.json();
  } catch (e) {
    // Fallback: plain text payload
    rawData = { title: 'EVGreen', body: event.data.text() };
  }

  console.log(`[SW ${SW_VERSION}] Push payload:`, JSON.stringify(rawData).substring(0, 500));

  // ── Normalize title ──
  // FCM may place title in: notification.title, data.title, or top-level title
  const title = rawData.notification?.title 
    || rawData.data?.title 
    || rawData.title 
    || 'EVGreen';

  // ── Normalize body ──
  const body = rawData.notification?.body 
    || rawData.data?.body 
    || rawData.body 
    || 'Nueva notificación';

  // ── Normalize image ──
  const image = rawData.notification?.image 
    || rawData.notification?.imageUrl 
    || rawData.data?.imageUrl 
    || rawData.imageUrl;

  // ── Normalize click action URL ──
  const clickAction = rawData.data?.clickAction 
    || rawData.data?.url 
    || rawData.data?.actionUrl 
    || rawData.fcmOptions?.link 
    || rawData.notification?.click_action 
    || rawData.url 
    || '/';

  // ── Notification type for tag/routing ──
  const notifType = rawData.data?.type || 'general';

  console.log(`[SW ${SW_VERSION}] Showing notification: title="${title}", body="${body}", type=${notifType}`);

  const options = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: notifType,
    renotify: true,
    requireInteraction: ['low_balance', 'charging_error', 'overstay_alert'].includes(notifType),
    data: {
      url: clickAction,
      type: notifType,
      ...(rawData.data || {}),
    },
    actions: rawData.actions || [],
  };

  if (image) {
    options.image = image;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Forward to any open app windows for in-app notification display
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            clientList.forEach((client) => {
              client.postMessage({
                type: 'PUSH_NOTIFICATION',
                title,
                body,
                data: rawData.data || {},
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
