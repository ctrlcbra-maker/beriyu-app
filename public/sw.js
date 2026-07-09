// Service worker sederhana — cache app shell agar bisa dibuka saat offline.
const CACHE = 'beriyu-v2';
const ASSETS = [
  '/', '/index.html',
  '/css/style.css',
  '/js/app.js', '/js/config.js', '/js/db.js', '/js/whatsapp.js',
  '/manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // jangan cache panggilan ke Supabase / WhatsApp
  if (request.url.includes('supabase') || request.url.includes('wa.me')) return;
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
