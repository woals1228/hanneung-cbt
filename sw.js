// 오프라인에서도 열리도록 앱 파일을 저장해 둬요.
// 배포할 때마다 CACHE 이름의 숫자를 올려 주세요. 파일을 새로 추가하면 SHELL 목록에도 넣어요.
// 개인용 기출(data/past/…)은 공개하지 않으니 여기에 넣지 않아요.
const CACHE = 'hcbt-v38';
const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/config.js',
  'js/data.js',
  'js/dates.js',
  'js/store.js',
  'js/track.js',
  'js/push.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/quiz.js',
  'js/views/notebook.js',
  'js/views/exam.js',
  'js/views/stats.js',
  'js/views/settings.js',
  'js/views/hot.js',
  'data/questions.json',
  'data/anniversaries.json',
  'data/exams.json',
  'data/daily.json',
  'data/frequency.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

// 기출 이미지(개인용)는 버전이 바뀌어도 지우지 않는 따로 된 캐시에 둬요. 한 번 받으면 PC가 꺼져 있어도 풀 수 있어요.
const PAST_CACHE = 'hcbt-past';
const isPast = url => /\/data\/past[/-]/.test(new URL(url).pathname);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== PAST_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 인터넷이 되면 항상 최신 파일을 받고, 안 될 때만 저장해 둔 파일을 써요.
// cache: 'no-cache' — GitHub Pages가 파일을 몇 분 캐시하라고 알려 줘도 매번 서버에 새 버전이 있는지 확인해요.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // 기출 이미지는 바뀌지 않아요. 저장해 둔 게 있으면 그걸 먼저 써요.
  if (new URL(request.url).pathname.includes('/data/past/')) {
    event.respondWith(caches.open(PAST_CACHE).then(async cache => (await cache.match(request)) ?? fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })));
    return;
  }
  // 페이지 이동 요청에는 옵션을 붙일 수 없어서 주소로 다시 요청해요.
  const fresh = request.mode === 'navigate' ? fetch(request.url, { cache: 'no-cache' }) : fetch(request, { cache: 'no-cache' });
  event.respondWith(
    fresh
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(isPast(request.url) ? PAST_CACHE : CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request, { ignoreSearch: true })) ?? caches.match('index.html')),
  );
});

// ── 매일 알림 ── 보내는 쪽: tools/send-push.mjs
self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data?.json() ?? {}; } catch {}
  event.waitUntil(self.registration.showNotification(msg.title ?? '한능검 CBT', {
    body: msg.body ?? '오늘의 문제가 도착했어요',
    icon: 'icons/icon-192.png',
    badge: 'icons/favicon-32.png',
    data: { url: msg.url ?? '#/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = `${self.registration.scope}?src=push${event.notification.data?.url ?? '#/'}`;
  event.waitUntil(self.clients.openWindow(url));
});
