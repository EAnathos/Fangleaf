// Service worker de Fangleaf : de quoi installer le jeu comme une application (PWA), et le rouvrir vite.
// - Pages : le réseau d'abord (toujours la dernière version), la copie en cache seulement hors ligne.
// - Fichiers /assets/ (noms avec empreinte, donc jamais modifiés) : le cache d'abord.
// - Rien d'autre n'est intercepté : ni la connexion au jeu (/ws), ni les comptes, ni les polices.
// v2 : jette les copies de v1, dont des pages HTML gardées sous le nom d'un script pendant un déploiement.
const CACHE = 'fangleaf-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/ws')) return;
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      // Une page HTML n'est jamais un fichier du build : un serveur d'avant le correctif la renvoyait pour un fichier
      // absent, et la garder ici bloquerait le jeu pour de bon (le cache d'abord).
      if (res.ok && !res.headers.get('content-type')?.includes('text/html')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/')) ?? Response.error();
      }
    })());
  }
});
