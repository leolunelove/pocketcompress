// Change this version whenever releasing new app files, to update them together.
const VERSION = 'png-tuck-v8';
const BASE = self.registration.scope;
const CACHE = `${VERSION}:${BASE}`;
const ASSETS = [
  './', './index.html', './style.css', './app.js', './pwa.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './compress-worker.js', './convert-worker.js', './vendor/jszip.min.js',
  './vendor/oxipng/codec/pkg/squoosh_oxipng.js',
  './vendor/oxipng/codec/pkg/squoosh_oxipng_bg.wasm',
  './vendor/png/decode.js', './vendor/png/codec/pkg/squoosh_png.js',
  './vendor/png/codec/pkg/squoosh_png_bg.wasm'
].map(path => new URL(path, BASE).href);
const OPTIONAL = [new URL('./vendor/heif/libheif-bundle.mjs', BASE).href];
const allowed = new Set([...ASSETS, ...OPTIONAL]);

async function prepareOffline() {
  const cache = await caches.open(CACHE);
  const missing = [];
  for (const url of ASSETS) if (!await cache.match(url)) missing.push(url);
  if (missing.length) {
    await cache.addAll(missing.map(url => new Request(url, { cache: 'reload' })));
  }
}

self.addEventListener('install', event => {
  event.waitUntil(prepareOffline());
  // Let an existing version finish its session before activating an update.
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_OFFLINE' || !event.ports[0]) return;
  event.waitUntil(prepareOffline().then(
    () => event.ports[0].postMessage({ offlineReady: true }),
    () => event.ports[0].postMessage({ offlineReady: false })
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('png-tuck-') && name.endsWith(`:${BASE}`) && name !== CACHE) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  if (!allowed.has(url.href)) return;
  // Only these application assets are cached. Image files and blobs never are.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached=await cache.match(url.href);
    if(cached)return cached;
    const response=await fetch(event.request);
    if(response.ok && OPTIONAL.includes(url.href))await cache.put(url.href,response.clone());
    return response;
  })());
});
