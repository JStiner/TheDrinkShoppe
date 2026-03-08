
self.addEventListener('install', e => {
  e.waitUntil(caches.open('drink-shoppe-fix-v3').then(c => c.addAll([
    './','./index.html','./admin.html','./app.js','./admin.js','./menu.json','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'
  ])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
