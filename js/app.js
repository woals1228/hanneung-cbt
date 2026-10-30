// 앱 시작점: 데이터를 불러오고 주소(#/...)에 맞는 화면을 그려요.
import { loadData } from './data.js';
import { closeModal } from './ui.js';
import { track, platform, isAndroid, isKakao } from './track.js';
import * as home from './views/home.js';
import * as quiz from './views/quiz.js';
import * as notebook from './views/notebook.js';
import * as exam from './views/exam.js';
import * as stats from './views/stats.js';
import * as settings from './views/settings.js';
import * as hot from './views/hot.js';

// solve = 학습 모드 풀이 화면 (모의고사와 같은 화면을 써요)
const routes = { '': home, quiz, notebook, exam, solve: exam, stats, settings, hot };
const root = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let updateReady = false;

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name = '', ...parts] = path.split('/');
  return { name: name in routes ? name : '', parts, params: new URLSearchParams(query) };
}

function render() {
  const route = parseRoute();
  // 새 버전이 준비됐으면 풀이 화면이 아닐 때 한 번 새로고침해요 (풀던 답안과 타이머는 저장돼 있어요).
  if (updateReady && route.parts[0] !== 'run') {
    location.reload();
    return;
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  closeModal();
  document.body.classList.remove('focus-mode');

  const activeTab = { quiz: '', solve: '', settings: 'stats' }[route.name] ?? route.name;
  for (const link of tabbar.querySelectorAll('a')) {
    const active = link.dataset.tab === activeTab;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  // 화면마다 새 상자를 만들어서 이전 화면의 이벤트가 남지 않게 해요.
  const view = document.createElement('div');
  root.replaceChildren(view);
  cleanup = routes[route.name].render(view, route);
  window.scrollTo(0, 0);
}

async function start() {
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="card empty"><p><b>문제를 불러오지 못했어요.</b><br>인터넷 연결을 확인하고 다시 열어 주세요.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  render();
  track('visit');
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) track('standalone');
  if (new URLSearchParams(location.search).get('src') === 'push') track('push_open');
  if (platform === 'inapp') showInappBanner();
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return; // 처음 설치될 때는 새로고침하지 않아요.
      updateReady = true;
      if (parseRoute().parts[0] !== 'run') location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('오프라인 기능을 켜지 못했어요', err));
  }
}

// 카톡·네이버 등 앱 안 브라우저에서는 알림과 오프라인이 잘 안 돼서 크롬·사파리로 옮기라고 안내해요.
function showInappBanner() {
  const url = location.href;
  let action = '<span>오른쪽 아래 ··· 메뉴에서 "Safari로 열기"를 눌러 주세요.</span>';
  if (isKakao) action = `<a class="btn btn-sm btn-inverse" href="kakaotalk://web/openExternal?url=${encodeURIComponent(url)}">기본 브라우저로 열기</a>`;
  else if (isAndroid) action = `<a class="btn btn-sm btn-inverse" href="intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end">크롬으로 열기</a>`;
  const bar = document.createElement('div');
  bar.className = 'inapp-banner';
  bar.innerHTML = `<p>앱 안 브라우저에서는 알림과 기록 저장이 잘 안 돼요. 크롬이나 사파리로 열어 주세요.</p>${action}`;
  document.body.prepend(bar);
}

start();
