// EVGreen Service Worker v5.0.0 - Auto-recovery + improved cache management
const CACHE_VERSION = 'v5';
const CACHE_NAME = `evgreen-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Solo cachear recursos estáticos que NO cambian con cada build
const PRECACHE_ASSETS = [
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/badge-72x72.png'
];

// Patrones de archivos con hash
function isHashedAsset(url) {
  const pathname = new URL(url).pathname;
  return pathname.startsWith('/assets/') && /[-\.][a-zA-Z0-9]{6,}\.(js|css)$/.test(pathname);
}

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log(`[SW ${CACHE_VERSION}] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW ${CACHE_VERSION}] Cacheando recursos estáticos`);
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar TODOS los caches viejos
self.addEventListener('activate', (event) => {
  console.log(`[SW ${CACHE_VERSION}] Activando...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW ${CACHE_VERSION}] Eliminando cache antiguo:`, name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW ${CACHE_VERSION}] Tomando control de clientes`);
      return self.clients.claim();
    })
  );
});

// Estrategia de fetch
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;

  // Ignorar peticiones a otros orígenes
  if (!event.request.url.startsWith(self.location.origin)) return;

  const pathname = new URL(event.request.url).pathname;

  // Para peticiones de API: Network Only (nunca cachear)
  if (pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Sin conexión a internet' }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Para Vite dev server resources: let browser handle directly
  if (pathname.startsWith('/@') || pathname.startsWith('/src/') || pathname.startsWith('/node_modules/')) {
    return;
  }

  // Para navegación (páginas HTML): Network First, NO cachear index.html
  // Esto previene que el SW sirva una versión vieja del HTML que referencia JS con hashes viejos
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // No cachear la página principal para evitar versiones stale
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_URL).then(r => r || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Para assets con hash (JS/CSS de Vite build): Network First
  if (isHashedAsset(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('javascript') || contentType.includes('css')) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response('Asset not available offline', { 
              status: 503, 
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  // Para recursos estáticos (imágenes, fuentes, iconos): Cache First con revalidación
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Escuchar mensaje de actualización forzada desde la app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    }).then(() => {
      console.log(`[SW ${CACHE_VERSION}] Cache limpiado por solicitud de la app`);
    });
  }
});

// Manejar notificaciones push (FCM y genéricas)
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

// Rutas válidas de la app para validar redirecciones
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

// Manejar click en notificaciones
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
    console.log(`[SW] Invalid route "${notifData.url || notifData.clickAction}", redirecting to ${targetPath} based on type "${notifType}"`);
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

// Sincronización en background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-charges') {
    event.waitUntil(syncPendingCharges());
  }
});

async function syncPendingCharges() {
  console.log(`[SW ${CACHE_VERSION}] Sincronizando cargas pendientes...`);
}
