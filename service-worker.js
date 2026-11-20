const CACHE_PREFIX = 'etf-rechner-';
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './historical-data.js',
  './app.js',
  './pwa.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// cache:'reload' umgeht den HTTP-Cache des Browsers. Ohne das kann ein frisch
// installierter Worker eine veraltete Datei aus dem Browser-Cache uebernehmen
// und dauerhaft weiter ausliefern.
function shellRequests() {
  return APP_SHELL.map(url => new Request(url, { cache: 'reload' }));
}

// Erst den neuen Stand vollstaendig laden, dann die alten Caches verwerfen.
// Umgekehrt waere die App nach einem fehlgeschlagenen Download offline kaputt:
// addAll ist alles-oder-nichts, ein einziger misslungener Request reicht.
async function refreshShell() {
  const staging = `${CACHE_NAME}-neu`;
  await caches.delete(staging);
  const cache = await caches.open(staging);
  await cache.addAll(shellRequests());

  const fresh = await caches.open(CACHE_NAME);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response) await fresh.put(request, response);
  }
  await caches.delete(staging);

  const names = await caches.keys();
  await Promise.all(
    names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name))
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(shellRequests()))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  const type = event.data?.type;
  const reply = payload => {
    if (event.ports?.[0]) event.ports[0].postMessage(payload);
    else event.source?.postMessage(payload);
  };

  if (type === 'etf-version') {
    reply({ type: 'etf-version', version: CACHE_NAME.slice(CACHE_PREFIX.length) });
    return;
  }

  if (type === 'etf-refresh') {
    event.waitUntil(
      refreshShell().then(
        () => reply({ type: 'etf-refresh', ok: true }),
        () => reply({ type: 'etf-refresh', ok: false })
      )
    );
  }
});

// Stale-while-revalidate: sofort aus dem Cache, Auffrischung im Hintergrund.
// Nie auf das Netz warten, solange ein Cache-Treffer da ist - sonst haengt die
// App im Mobilfunknetz an der unerreichbaren WLAN-IP des Servers.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
            }
            return response;
          })
          .catch(() => null);
        event.waitUntil(network);
        return cached || network.then(r => r || caches.match('./index.html'));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return network.then(r => r || Response.error());
    })
  );
});
