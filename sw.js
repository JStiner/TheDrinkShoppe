
self.addEventListener('install',e=>{
 e.waitUntil(caches.open('drink-shoppe').then(c=>c.addAll(['./','index.html','admin.html','app.js','admin.js','menu.json','manifest.json'])))
})
self.addEventListener('fetch',e=>{
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))
})
