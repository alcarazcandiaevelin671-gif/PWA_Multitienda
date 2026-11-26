/* eslint-disable no-restricted-globals */
/**
 * Service worker — Portal Guairá Multitienda (modo offline).
 *
 * Estrategias:
 *  - /_next/static, fuentes, íconos ............ cache-first (archivos con hash, inmutables)
 *  - Imágenes (next/image, Supabase Storage, mapas) stale-while-revalidate
 *  - Páginas (navegación) y datos RSC .......... network-first con timeout; sin red -> caché -> /offline
 *  - Supabase REST (GET) y /auth/v1/user ........ network-first; sin red -> última respuesta guardada
 *  - /api/* GET de la app ....................... network-first
 * Los POST (checkout, etc.) no se cachean: la app los guarda en una cola y los reenvía al reconectar.
 */
const VERSION = 'v3';
const STATIC_CACHE = `pg-static-${VERSION}`;
const PAGES_CACHE = `pg-pages-${VERSION}`;
const DATA_CACHE = `pg-data-${VERSION}`;
const IMAGES_CACHE = `pg-images-${VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE, IMAGES_CACHE];

const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icon-192.png', '/logo-128.png', '/favicon-32.png'];

// Rutas con datos personales: se borran de la caché al cerrar sesión o cambiar de usuario.
const PRIVATE_PREFIXES = ['/pedidos', '/facturas', '/perfil', '/configuracion', '/checkout', '/favoritos',
  '/notificaciones', '/vendedor', '/comerciante', '/admin'];

const IMAGE_HOSTS = ['tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org'];
const MAX_IMAGES = 250;

// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('pg-') && !ALL_CACHES.includes(key)).map((key) => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable().catch(() => undefined);
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------------------
const isCacheable = (response) => response && response.ok && !response.redirected
  && (response.type === 'basic' || response.type === 'cors' || response.type === 'default');

/** Nunca lanza: si falla (cuota, "Entry already exists" por guardados simultáneos), se ignora. */
async function putInCache(cacheName, request, response) {
  if (!isCacheable(response)) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (error) {
    console.warn('[sw] no se pudo guardar en caché:', request.url, error && error.message);
  }
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  await putInCache(cacheName, request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, request, cacheName, max) {
  const cached = await caches.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then((response) => {
      event.waitUntil(putInCache(cacheName, request, response.clone())
        .then(() => (max ? trimCache(cacheName, max) : undefined))
        .catch(() => undefined));
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

/** Red primero; si tarda más de `timeoutMs` y hay copia guardada, responde con la copia. */
async function networkFirst(event, request, cacheName, { timeoutMs = 4000, ignoreSearch = false } = {}) {
  const cached = caches.match(request, { ignoreVary: true, ignoreSearch });
  const network = fetch(request).then((response) => {
    // Guardar en segundo plano: un error de caché nunca debe romper la respuesta.
    event.waitUntil(putInCache(cacheName, request, response.clone()));
    return response;
  });
  event.waitUntil(network.catch(() => undefined));

  try {
    const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs, 'timeout'));
    const winner = await Promise.race([network, timeout]);
    if (winner !== 'timeout') return winner;
    return (await cached) || await network;
  } catch (error) {
    const fallback = await cached;
    if (fallback) return fallback;
    throw new Error(`offline (${error && error.message})`);
  }
}

async function handleNavigation(event) {
  // Petición nueva en lugar de event.request: Chrome rechaza volver a pedir una navegación que
  // llegó por redirección (p. ej. middleware /pedidos -> /auth/login). redirect 'manual' conserva
  // las redirecciones del servidor para que el navegador las siga.
  const request = new Request(event.request.url, {
    method: 'GET',
    headers: event.request.headers,
    credentials: 'include',
    redirect: 'manual',
  });
  try {
    return await networkFirst(event, request, PAGES_CACHE, { timeoutMs: 6000 });
  } catch (error) {
    console.warn('[sw] navegación sin red:', event.request.url, error && error.message);
    // Misma página con otros parámetros (?origen=whatsapp, etc.)
    const sameRoute = await caches.match(event.request, { ignoreSearch: true, ignoreVary: true });
    return sameRoute || (await caches.match(OFFLINE_URL)) || new Response('Sin conexión', { status: 503 });
  }
}

// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Mismo origen ------------------------------------------------------------
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.includes('.hot-update.')) return;
    if (url.pathname === '/sw.js') return;

    if (url.pathname.startsWith('/_next/static/') || /\.(?:woff2?|ttf|otf)$/.test(url.pathname)
      || PRECACHE.includes(url.pathname)) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (url.pathname.startsWith('/_next/image') || /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(event, request, IMAGES_CACHE, MAX_IMAGES));
      return;
    }
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(event));
      return;
    }
    if (request.headers.get('RSC') === '1') {
      // Datos de navegación del App Router. Sin red ni copia, Next recarga la página completa
      // y esa navegación la resuelve handleNavigation (caché o /offline).
      event.respondWith(networkFirst(event, request, PAGES_CACHE, { timeoutMs: 5000 }).catch(() => Response.error()));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirst(event, request, DATA_CACHE).catch(() => Response.error()));
      return;
    }
    return;
  }

  // Supabase ----------------------------------------------------------------
  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      event.respondWith(staleWhileRevalidate(event, request, IMAGES_CACHE, MAX_IMAGES));
      return;
    }
    if (url.pathname.startsWith('/rest/v1/') || url.pathname === '/auth/v1/user') {
      event.respondWith(networkFirst(event, request, DATA_CACHE).catch(() => Response.error()));
      return;
    }
    return;
  }

  // Mosaicos de mapas --------------------------------------------------------
  if (IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, request, IMAGES_CACHE, MAX_IMAGES));
  }
});

// ---------------------------------------------------------------------------
async function clearPrivateData() {
  await caches.delete(DATA_CACHE);
  const pages = await caches.open(PAGES_CACHE);
  const keys = await pages.keys();
  await Promise.all(keys
    .filter((request) => PRIVATE_PREFIXES.some((prefix) => new URL(request.url).pathname.startsWith(prefix)))
    .map((request) => pages.delete(request)));
}

/** Descarga páginas clave y sus JS/CSS para que funcionen sin haberlas visitado. */
async function warmUp(urls) {
  const pages = await caches.open(PAGES_CACHE);
  const assets = await caches.open(STATIC_CACHE);
  for (const path of urls) {
    try {
      const response = await fetch(path, { credentials: 'same-origin' });
      if (!isCacheable(response)) continue;
      const html = await response.clone().text();
      await pages.put(new Request(path), response);
      const found = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
      for (const asset of found) {
        if (!(await assets.match(asset))) await assets.add(asset).catch(() => undefined);
      }
    } catch {
      // sin red: se reintenta en la próxima carga
    }
  }
}

self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type === 'CLEAR_PRIVATE') event.waitUntil(clearPrivateData());
  if (type === 'WARM_UP' && Array.isArray(urls)) event.waitUntil(warmUp(urls));
  if (type === 'SKIP_WAITING') self.skipWaiting();
});
