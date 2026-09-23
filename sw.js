// Minimal offline app-shell cache. Data itself never goes through here —
// it lives in localStorage and (optionally) your GitHub Gist — this only
// caches the page's own files so it still opens with no signal.
const CACHE = 'lang-rotation-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){ return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  // Never intercept the GitHub API — that traffic must always hit the network.
  if (event.request.url.indexOf('api.github.com') !== -1) return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
