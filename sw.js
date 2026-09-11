/* ===================================================================
   Kingdom of Saint-Dié — service worker
   Ecoconcepción: caché ligera. Se precachea solo el "esqueleto" de la
   app; los assets del mapa y las fuentes se guardan a medida que se
   usan (stale-while-revalidate). Nada de Supabase se cachea nunca.
   Sube el número de versión para forzar actualización.
   =================================================================== */
const VERSION = 'ksd-v2';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const SHELL_FILES = [
  '.', 'index.html',
  'map-engine.js', 'supabase-client.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // cachea cada fichero por separado: si uno falla, no tumba el resto
      .then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase (datos en vivo): siempre red, nunca caché.
  if (/supabase\.co$/.test(url.hostname) || url.hostname.endsWith('supabase.in')) return;

  // Navegación: red primero, con el HTML cacheado de reserva (offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((r) => r || caches.match('.')))
    );
    return;
  }

  // Fuentes de Google: caché primero (cambian poco).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(RUNTIME).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  // Resto de mismo origen (js, assets del mapa, iconos): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(RUNTIME).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && res.status === 200) c.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});

/* ===================================================================
   NOTIFICACIONES PUSH
   El payload lo arma la función de servidor (push-notify), ya en el
   idioma de quien recibe. Aquí solo se muestra.
   =================================================================== */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { title: 'Kingdom of Saint-Dié', body: e.data && e.data.text() }; }
  const title = data.title || 'Kingdom of Saint-Dié';
  const options = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || 'ksd',       // un aviso nuevo del mismo tipo reemplaza al anterior, no se amontonan
    renotify: !!data.tag,
    data: { url: data.url || '.' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '.';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
