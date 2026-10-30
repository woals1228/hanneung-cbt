// 오프라인에서도 열리도록 앱 파일을 저장해 둬요.
// 배포할 때마다 CACHE 이름의 숫자를 올려 주세요. 파일을 새로 추가하면 SHELL 목록에도 넣어요.
// 개인용 기출(data/past/…)은 공개하지 않으니 여기에 넣지 않아요.
const CACHE = 'hcbt-v3';
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
  'js/ui.js',
  'js/views/home.js',
  'js/views/quiz.js',
  'js/views/notebook.js',
  'js/views/exam.js',
  'js/views/stats.js',
  'js/views/settings.js',
  'data/questions.json',
  'data/anniversaries.json',
  'data/exams.json',
  'data/daily.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 인터넷이 되면 항상 최신 파일을 받고, 안 될 때만 저장해 둔 파일을 써요.
// cache: 'no-cache' — GitHub Pages가 파일을 몇 분 캐시하라고 알려 줘도 매번 서버에 새 버전이 있는지 확인해요.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // 페이지 이동 요청에는 옵션을 붙일 수 없어서 주소로 다시 요청해요.
  const fresh = request.mode === 'navigate' ? fetch(request.url, { cache: 'no-cache' }) : fetch(request, { cache: 'no-cache' });
  event.respondWith(
    fresh
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request, { ignoreSearch: true })) ?? caches.match('index.html')),
  );
});
