// 앱 파일(HTML·CSS·JS·아이콘·글꼴)을 휴대폰에 저장해 두고 바로 띄운다.
// 저장본을 먼저 주고, 뒤에서 새 파일을 받아 저장본을 바꾼다 → 새 버전은 다음에 열 때 보인다.
const CACHE = 'career-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  if (!sameOrigin && !/cdn\.jsdelivr\.net/.test(req.url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 주소의 #… 이나 ?… 와 상관없이 같은 페이지로
    const key = req.mode === 'navigate' ? new Request(new URL('./', location).href) : req;
    const cached = await cache.match(key);
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      e.waitUntil(fresh);
      return cached;
    }
    return (await fresh) ?? Response.error();
  })());
});
