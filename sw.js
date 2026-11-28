// 메생여전 서비스 워커
// 인터넷이 되면 항상 새 버전을 받고(network-first), 안 되면 저장해 둔 화면을 보여 준다.
// 기록 데이터는 Firebase(Firestore)가 따로 오프라인 저장을 하므로 여기서는 화면 파일만 다룬다.
const CACHE = 'meso-safe-v53';
const SHELL = ['./', './index.html', './firebase-config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 같은 사이트 파일, Firebase SDK, 글꼴만 캐시한다 (Firestore/로그인 통신은 건드리지 않음)
  const ok = url.origin === location.origin || url.hostname === 'www.gstatic.com' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
