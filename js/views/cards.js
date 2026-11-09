// 전날 복습 암기 카드: 빈출 주제(24회 중 20회↑)의 기출 해설 keyPoint '단서 → 정답'을 앞뒤로 뒤집어 외워요.
import * as data from '../data.js';
import { esc } from '../ui.js';

const PER_TOPIC = 3; // 주제마다 최근 기출 3개까지(전부 보이면 752장이라 너무 많아요)

// 해설 keyPoint 하나 → { cue, answer }. '→'가 없으면 카드로 못 써요.
export function splitKeyPoint(kp = '') {
  const i = kp.indexOf('→');
  if (i < 0) return null;
  const cue = kp.slice(0, i).trim();
  const answer = kp.slice(i + 1).trim();
  return cue && answer ? { cue, answer } : null;
}

function buildDeck(era) {
  const topics = data.frequency().filter(f => f.all >= 20 && (!era || f.era === era)).sort((a, b) => b.all - a.all || b.recent - a.recent);
  const deck = [];
  for (const f of topics) {
    const seen = new Set();
    for (const id of f.pastIds ?? []) {
      const card = splitKeyPoint(data.getQuestion(id)?.keyPoint);
      if (!card || seen.has(card.answer)) continue;
      seen.add(card.answer);
      deck.push({ ...card, f, id });
      if (seen.size >= PER_TOPIC) break;
    }
  }
  return deck;
}

export function render(el, route) {
  const era = route.params.get('era') ?? '';
  // shortcut: '다시'·'알아요'는 이번 복습에서만 기억해요. 기기에 남기려면 store에 저장 키를 추가해요.
  let queue = [];
  let total = 0;
  let known = 0;
  let flipped = false;

  const chips = `<div class="chips">${['', ...data.ERAS.filter(e => e !== '선사')].map(e => `<a class="chip ${e === era ? 'is-active' : ''}" href="#/cards${e ? `?era=${encodeURIComponent(e)}` : ''}">${e || '전체'}</a>`).join('')}</div>`;

  function draw() {
    const head = `<header class="page-head"><h1>전날 복습 암기 카드</h1><a class="btn btn-ghost btn-sm" href="#/hot">나가기</a></header>${chips}`;
    if (!total) {
      el.innerHTML = `${head}<section class="card empty mt"><p>이 시대에는 아직 카드가 없어요.</p></section>`;
      return;
    }
    const c = queue[0];
    if (!c) {
      el.innerHTML = `${head}<section class="card mt center"><h2>${total}장 다 봤어요 🎉</h2>
        <p class="muted">이제 문제로 확인해 보세요.</p>
        <a class="btn btn-primary btn-block mt" href="#/quiz?mode=hot">빈출 예상 10문제 풀기</a>
        <button type="button" class="btn btn-ghost btn-block mt" data-act="again">카드 처음부터 다시</button></section>`;
      return;
    }
    el.innerHTML = `${head}
      <p class="muted small mt">${known} / ${total}장 외움 · 남은 카드 ${queue.length}장</p>
      <div class="progress" aria-hidden="true"><span style="width:${Math.round((known / total) * 100)}%"></span></div>
      <section class="card mt flashcard" data-act="flip" role="button" tabindex="0" aria-label="카드 뒤집기">
        <p class="eyebrow">${flipped ? `${esc(c.f.era)} · ${esc(c.f.topic)} · ` : '이 단서는 무엇? · '}24회 중 ${c.f.all}회 출제</p>
        <p class="flash-cue">${esc(c.cue)}</p>
        ${flipped ? `<p class="flash-answer">→ ${esc(c.answer)}</p>` : '<p class="muted small center mt">눌러서 정답 보기</p>'}
      </section>
      ${flipped ? `<div class="row mt">
          <button type="button" class="btn btn-ghost grow" data-act="later">다시 볼래요</button>
          <button type="button" class="btn btn-primary grow" data-act="know">알아요</button>
        </div>
        <a class="btn btn-ghost btn-block btn-sm mt" href="#/${data.concept(c.f.topic) ? 'concept' : 'quiz?mode=topic&'}${data.concept(c.f.topic) ? '?' : ''}t=${encodeURIComponent(c.f.topic)}">'${esc(c.f.topic)}' ${data.concept(c.f.topic) ? '개념 카드 보기' : '문제 풀기'}</a>` : ''}`;
  }

  function start() {
    queue = buildDeck(era);
    total = queue.length;
    known = 0;
    flipped = false;
    draw();
  }

  el.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'flip' && !flipped) flipped = true;
    else if (act === 'know') { queue.shift(); known += 1; flipped = false; }
    else if (act === 'later') { queue.push(queue.shift()); flipped = false; }
    else if (act === 'again') return start();
    else return;
    draw();
  });
  el.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-act="flip"]') && !flipped) {
      e.preventDefault();
      flipped = true;
      draw();
    }
  });

  el.innerHTML = '<p class="muted center mt">카드를 준비하는 중…</p>';
  data.pastNotesReady().then(start);
}
