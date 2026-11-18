const C = 'dostavka-1.3.0';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.svg', 'vendor/leaflet.js', 'vendor/leaflet.css',
  'js/app.js', 'js/api.js', 'js/i18n.js', 'js/ui.js', 'js/map.js', 'js/route.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) return; // карта, API, маршруты — всегда из сети
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok && !u.pathname.endsWith('version.json')) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
