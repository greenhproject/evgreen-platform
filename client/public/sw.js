// EVGreen Service Worker v3.0.0 - Fix: Network First para assets con hash
const CACHE_VERSION = 'v3';
const CACHE_NAME = `evgreen-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Solo cachear recursos estáticos que NO cambian con cada build
const PRECACHE_ASSETS = [
  '/offline.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/badge-72x72.png'
];

// Patrones de archivos con hash que NO deben cachearse con Cache First
// Estos archivos cambian de nombre con cada build (ej: Payouts-CAlPAeIf.js)
function isHashedAsset(url) {
  const pathname = new URL(url).pathname;
  // Archivos en /assets/ con hash en el nombre (ej: Payouts-CAlPAeIf.js, index-D9rVYooB.css)
  return pathname.startsWith('/assets/') && /[-\.][a-zA-Z0-9]{6,}\.(js|css)$/.test(pathname);
}

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log(`[SW ${CACHE_VERSION}] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW ${CACHE_VERSION}] Cacheando recursos estáticos`);
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activar inmediatamente
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

  // Para peticiones de API: Network Only (nunca cachear)
  if (event.request.url.includes('/api/')) {
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

  // Para navegación (páginas HTML): Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cachear la respuesta exitosa
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Para assets con hash (JS/CSS de Vite): Network First
  // Estos archivos cambian de nombre con cada build, así que SIEMPRE
  // debemos intentar obtener la versión más reciente del servidor
  if (isHashedAsset(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Solo cachear si la respuesta es válida (no un HTML fallback)
          if (response.ok && response.headers.get('content-type')?.includes('javascript') || 
              response.headers.get('content-type')?.includes('css')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Solo usar cache como fallback offline
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Si no hay cache, devolver error para que el error boundary lo maneje
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
          // Revalidar en background
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

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nueva notificación de EVGreen',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'EVGreen', options)
  );
});

// Manejar click en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
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
