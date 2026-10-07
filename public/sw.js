// Network-first navigation only. Never cache app JS, Clerk, Convex or personal data.
// Updates wait until existing tabs close; never reload an active workout.
const CACHE = 'reed-offline-v2';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/offline', '/icon-192.png'])));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('reed-offline-') && key !== CACHE)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin
    || url.pathname === '/sso-callback') return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match('/offline') ?? Response.error();
  }));
});
