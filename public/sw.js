// Cache only same-origin app shell and public assets. API/private images are excluded.
const CACHE = 'pixcraft-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/precache.json', { cache: 'reload' });
    if (!response.ok) throw new Error('Precache unavailable');
    const cache = await caches.open(CACHE);
    await cache.addAll(['/', '/favicon.svg', ...await response.json()]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('pixcraft-shell-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) await (await caches.open(CACHE)).put('/', response.clone());
      return response;
    }).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/media/') || url.pathname.includes('favicon')) {
    // Precache and browser asset requests can differ in Origin headers on Vite.
    // URL is constrained to same-origin public assets before ignoring Vary.
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then(hit => hit || fetch(event.request).then(async response => {
      if (response.ok) await (await caches.open(CACHE)).put(event.request, response.clone());
      return response;
    })));
  }
});
