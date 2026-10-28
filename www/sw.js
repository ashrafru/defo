/* Astrologers' Workbench Mobile — service worker. AGPL-3.0-or-later.
   Keeps the app shell offline and serves modules/<id>.html rebuilt from stored parts. */
const VERSION = 'aw-mobile-2.0.1-2';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'loader.js', 'fflate.min.js', 'catalog.json',
  'manifest.webmanifest', 'img/logo.webp', 'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png', 'licences.html', 'native.js', 'capacitor-bundle.js', 'simple/index.html', 'simple/simple.js'];
importScripts('loader.js');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('aw-mobile-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const scope = new URL(self.registration.scope);
  const rel = url.pathname.slice(scope.pathname.length);
  const m = /^modules\/([A-Za-z0-9_]+)\.html$/.exec(rel);
  if (m) {
    e.respondWith(AWStore.build(m[1]).then(
      blob => new Response(blob, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }),
      err => new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:24px;background:#101f2c;color:#d9e7ef">' +
        String(err.message || err).replace(/</g, '&lt;') + '</body>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  if (rel.startsWith('m/')) return; // handled by the store's own cache
  // App shell: network first so updates arrive, cache when offline.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(e.request);
      if (res.ok && (SHELL.includes(rel || './') || rel.endsWith('.pdf'))) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }
  })());
});
