// 학습 모드 문제 묶음을 만들어서 풀이 화면(#/solve/run)으로 보내요.
// 더 풀기, 오답 복습, 시대별, 기념일, 전야제, 한 문제 다시 풀기
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr } from '../dates.js';
import { esc, shuffle, goBack } from '../ui.js';
import { track } from '../track.js';
import { startSession } from './exam.js';

const MORE_COUNT = 3;
const SET_LIMIT = 10;
const OFFICIAL_URL = 'https://www.historyexam.go.kr/pst/list.do?bbs=dat';

function buildSet(mode, params, today) {
  const ids = list => list.map(q => q.id);
  switch (mode) {
    case 'more': {
      // 아직 안 푼 문제부터. 내일 이후의 오늘의 문제는 꺼내지 않아요.
      const era = params.get('era');
      const tried = new Set(store.getState().attempts.map(a => a.q));
      const pool = data.morePool(today).filter(q => !tried.has(q.id) && (!era || q.era === era));
      return { title: era ? `${era} 문제 더 풀기` : '문제 더 풀기', ids: ids(shuffle(pool).slice(0, MORE_COUNT)) };
    }
    case 'hot': {
      // 빈출 예상 주제부터, 아직 안 푼 문제를 먼저
      const tried = new Set(store.getState().attempts.map(a => a.q));
      const pool = shuffle(data.hotPool(today));
      pool.sort((a, b) => tried.has(a.id) - tried.has(b.id));
      return { title: '81회 빈출 예상 문제', ids: ids(pool.slice(0, SET_LIMIT)) };
    }
    case 'topic': {
      const f = data.frequency().find(x => x.topic === params.get('t'));
      const open = new Set(data.examPool(today).map(q => q.id));
      return { title: f ? `${f.topic} 문제` : '주제 문제', ids: f ? shuffle(f.ids.filter(id => open.has(id))) : [] };
    }
    case 'review':
      return { title: '오답 복습', ids: store.dueIds(today).filter(id => data.getQuestion(id)).slice(0, SET_LIMIT) };
    case 'wrong': {
      const items = store.notebookItems().filter(i => !i.mastered && data.getQuestion(i.id));
      return { title: '오답 다시 풀기', ids: shuffle(items).map(i => i.id) };
    }
    case 'era': {
      const era = params.get('era') ?? '';
      const pool = data.availableQuestions(today).filter(q => q.era === era);
      return { title: `${era} 문제`, ids: ids(shuffle(pool).slice(0, SET_LIMIT)) };
    }
    case 'anniv': {
      const anniv = data.anniversaryByDate(params.get('date') ?? '');
      return { title: anniv ? `${anniv.name} 퀴즈` : '기념일 퀴즈', ids: anniv ? ids(data.anniversaryQuestions(anniv, today)) : [] };
    }
    case 'eve': {
      const exam = data.nextExam(today);
      return { title: exam ? `제${exam.round}회 전야제 문제` : '전야제 문제', ids: exam ? ids(data.eveQuestions(exam, today)) : [] };
    }
    case 'one': {
      const id = params.get('id');
      return { title: '다시 풀기', ids: data.getQuestion(id) ? [id] : [] };
    }
    default:
      return { title: '문제', ids: [] };
  }
}

const EVENT_OF = { more: 'more', hot: 'more', anniv: 'anniv', eve: 'eve_start' };

export function render(el, route) {
  const today = todayStr();
  const mode = route.params.get('mode') ?? 'more';
  const key = [mode, route.params.get('era'), route.params.get('date'), route.params.get('id'), route.params.get('t')].filter(Boolean).join(':');

  // 같은 묶음을 풀던 중이면 이어서 풀어요.
  if (store.getDraft('study')?.key === key) {
    location.replace('#/solve/run');
    return;
  }
  const set = buildSet(mode, route.params, today);
  if (set.ids.length) {
    if (EVENT_OF[mode]) track(EVENT_OF[mode]);
    startSession('study', { ...set, kind: mode, key }, { replace: true });
    return;
  }

  const empty = {
    more: '오늘 더 풀 문제를 다 풀었어요. 내일 새 문제가 와요!',
    review: '오늘 복습할 문제가 없어요 👍',
    wrong: '오답노트가 비어 있어요.',
    eve: '전야제 문제가 아직 없어요.',
    anniv: '이 기념일에 연결된 문제가 아직 없어요.',
  }[mode] ?? '풀 문제가 없어요.';
  el.innerHTML = `
    <header class="page-head"><div><button type="button" class="back" data-act="back">← 뒤로</button><h1>${esc(set.title)}</h1></div></header>
    <div class="card empty">
      <p>${empty}</p>
      ${mode === 'more' ? `<p class="small">실제 기출문제는 국사편찬위원회 시험 자료실에서 볼 수 있어요.</p>
        <a class="btn btn-ghost" href="${OFFICIAL_URL}" target="_blank" rel="noopener" data-out>기출문제 보러 가기 ↗</a>` : ''}
      <a class="btn btn-primary" href="#/">홈으로</a>
    </div>`;
  el.addEventListener('click', e => {
    if (e.target.closest('[data-out]')) track('outlink');
    if (e.target.closest('[data-act="back"]')) goBack();
  });
}
