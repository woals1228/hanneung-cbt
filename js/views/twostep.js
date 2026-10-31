// 기출 2단계 연습: ① 자료가 가리키는 대상(왕·인물·사건)을 먼저 고르고 ② 원래 기출 문제를 풀어요.
// ①의 정답은 박사가 쓴 해설 keyPoint의 '단서 → 대상(…)'에서 뽑아요. 오답은 같은 시대의 다른 대상이에요.
import * as data from '../data.js';
import * as store from '../store.js';
import { esc, shuffle, questionHTML, explanationHTML, CIRCLED } from '../ui.js';
import { track, logAnswers } from '../track.js';

const MAX_TARGET = 14;

// '단서 → 대상(덧붙임)'에서 대상만. (가)·(나)가 여럿이거나 순서 문제처럼 대상이 하나가 아니면 쓰지 않아요.
function targetOf(q) {
  const kp = q.keyPoint ?? '';
  if (/\((가|나)\)/.test(kp)) return null;
  const t = (kp.split('→')[1] ?? '').split('(')[0].trim();
  return t && t.length <= MAX_TARGET && !/[,·]/.test(t) ? t : null;
}

function buildPool(era) {
  return [...data.practicePool('9999-12-31')].filter(q => q.past && (!era || q.era === era)).map(q => ({ q, target: targetOf(q) })).filter(x => x.target);
}

// 오답 보기: 같은 시대에서, 끝 글자가 같은 대상(왕↔왕, 운동↔운동)을 먼저 써요.
function choicesFor(item, pool) {
  const others = [...new Set(pool.filter(x => x.q.era === item.q.era && x.target !== item.target).map(x => x.target))];
  const last = item.target.at(-1);
  const same = shuffle(others.filter(t => t.at(-1) === last));
  const rest = shuffle(others.filter(t => t.at(-1) !== last));
  return shuffle([item.target, ...[...same, ...rest].slice(0, 4)]);
}

export function render(el, route) {
  const era = route.params.get('era') ?? '';
  let pool = [];
  let item = null;
  let options = [];
  let step1 = null; // 고른 대상
  let step2 = null; // 고른 보기 번호
  let solved = 0;
  let right = 0;

  const next = () => {
    const tried = new Set(store.getState().attempts.filter(a => a.mode === 'twostep').map(a => a.q));
    const fresh = pool.filter(x => !tried.has(x.q.id));
    const list = fresh.length ? fresh : pool;
    item = list[Math.floor(Math.random() * list.length)];
    options = choicesFor(item, pool);
    step1 = null;
    step2 = null;
    draw();
    window.scrollTo(0, 0);
  };

  function draw() {
    const q = item.q;
    const s1done = step1 != null;
    el.innerHTML = `
      <header class="page-head"><h1>기출 2단계 연습</h1><a class="btn btn-ghost btn-sm" href="#/exam">나가기</a></header>
      <div class="chips">${['', ...data.ERAS.filter(e => e !== '선사')].map(e => `<a class="chip ${e === era ? 'is-active' : ''}" href="#/twostep${e ? `?era=${encodeURIComponent(e)}` : ''}">${e || '전체'}</a>`).join('')}</div>
      <p class="muted small mt">실제 심화처럼 ① 자료가 가리키는 대상을 먼저 찾고 ② 그 대상의 다른 사실을 골라요.${solved ? ` · 이번에 ${solved}문제 중 ${right}개 정답` : ''}</p>
      <section class="card mt">
        ${questionHTML(q).replace(/<ol class="choices[\s\S]*?<\/ol>/, '')}
        <h3 class="question-text mt"><span class="question-no">①</span> 자료가 가리키는 것은?</h3>
        <ol class="choices">${options.map((t, i) => {
          const cls = ['choice'];
          if (s1done && t === item.target) cls.push('is-correct');
          if (s1done && t === step1 && t !== item.target) cls.push('is-wrong');
          return `<li><button type="button" class="${cls.join(' ')}" data-step1="${esc(t)}" ${s1done ? 'disabled' : ''}><span class="choice-no">${CIRCLED[i]}</span><span>${esc(t)}</span></button></li>`;
        }).join('')}</ol>
        ${s1done ? `<p class="keypoint mt"><b>단서</b> ${esc((q.keyPoint ?? '').split('→')[0].trim())} → <b>${esc(item.target)}</b></p>
          <h3 class="question-text mt"><span class="question-no">②</span> ${esc(q.stem || '원래 문제')}</h3>
          ${questionHTML(q, { selected: step2, revealed: step2 != null, hideHead: true }).replace(/^[\s\S]*?(<ol class="choices)/, '<div class="question">$1')}` : ''}
      </section>
      ${step2 != null ? '<button type="button" class="btn btn-primary btn-block mt" data-act="next">다음 문제 →</button>' : ''}`;
  }

  el.addEventListener('click', e => {
    const s1 = e.target.closest('[data-step1]');
    if (s1 && step1 == null) {
      step1 = s1.dataset.step1;
      draw();
      el.querySelector('.keypoint')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const c = e.target.closest('[data-choice]');
    if (c && step1 != null && step2 == null) {
      step2 = Number(c.dataset.choice);
      const ok = step2 === item.q.answer;
      solved += 1;
      if (ok) right += 1;
      store.recordAnswer(item.q.id, ok, 'twostep', false, step2);
      logAnswers('twostep', [{ q: item.q, pick: step2, ok, viewed: false }]);
      track('answer');
      draw();
      el.querySelector('.explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-act="next"]')) next();
  });

  el.innerHTML = '<p class="loading">기출 해설을 불러오는 중…</p>';
  data.pastNotesReady().then(() => {
    pool = buildPool(era);
    if (!pool.length) {
      el.innerHTML = '<div class="card empty"><p>2단계 연습에 쓸 기출이 없어요.</p><a class="btn btn-primary" href="#/exam">기출·모의고사로</a></div>';
      return;
    }
    next();
  });
}
