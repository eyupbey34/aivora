'use strict';
const CACHE = 'aivora-offline-v1';
const ROOT = new URL('./', self.location.href);
const OFFLINE = new URL('offline.html', ROOT).href;
const ASSETS = ['offline.html', 'app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png'].map(p => new URL(p, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('aivora-offline-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Auth, AI APIs, messages and all other private data always use the network.
  // No application HTML, scripts, tokens or API responses are cached.
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
  } else if (!url.search && ASSETS.includes(url.href)) {
    event.respondWith(caches.match(url.href).then(cached => cached || fetch(request)));
  }
});
