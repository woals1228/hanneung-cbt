// 순서 맞히기 훈련: 같은 시대 사건 4개를 일어난 순서대로 누르기 (한 판 10문제)
// 데이터: data/events.json (박사가 연도·월을 확인, 기원전은 음수)
import * as data from '../data.js';
import { esc, shuffle, toast } from '../ui.js';

const ROUNDS = 10;
const PICK = 4;
const LABELS = ['(가)', '(나)', '(다)', '(라)'];
const BEST_KEY = 'hcbt.order';
// 시험처럼 가까운 시기끼리 섞으려고, 정렬한 목록에서 이 폭 안에서 골라요.
const WINDOW = 9;

const keyOf = e => e.year * 100 + (e.month ?? 0);
const yearText = e => (e.year < 0 ? `기원전 ${-e.year}년` : `${e.year}년`) + (e.month ? ` ${e.month}월` : '');

function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) ?? {}; } catch { return {}; }
}

// 같은 해인데 월이 없거나 같은 사건끼리는 순서를 정할 수 없어서 함께 내지 않아요.
function pickRound(events) {
  const sorted = [...events].sort((a, b) => keyOf(a) - keyOf(b));
  for (let tries = 0; tries < 30; tries++) {
    const start = Math.floor(Math.random() * Math.max(1, sorted.length - WINDOW + 1));
    const chosen = [];
    for (const e of shuffle(sorted.slice(start, start + WINDOW))) {
      const clash = chosen.some(c => c.year === e.year && (!c.month || !e.month || c.month === e.month));
      if (!clash) chosen.push(e);
      if (chosen.length === PICK) return chosen;
    }
  }
  return null;
}

export function render(el) {
  let events = [];
  let era = '';
  let game = null; // { rounds: [{ items, taps, done, ok }], i }

  const pool = () => events.filter(e => !era || e.era === era);

  function startGame() {
    const rounds = [];
    const eras = [...new Set(pool().map(e => e.era))];
    for (let i = 0; i < ROUNDS; i++) {
      // '전체'면 판마다 시대를 바꿔요.
      const list = era ? pool() : events.filter(e => e.era === eras[i % eras.length]);
      const items = pickRound(list);
      if (items) rounds.push({ items: shuffle(items), taps: [], done: false, ok: false });
    }
    game = rounds.length ? { rounds, i: 0 } : null;
    if (!game) toast('이 시대는 아직 사건이 모자라요');
    draw();
  }

  function setupHTML() {
    const eras = data.ERAS.filter(x => events.some(e => e.era === x));
    const best = loadBest();
    return `<section class="card">
      <p>같은 시대 사건 4개를 <b>일어난 순서대로</b> 눌러요. 심화 시험에 매회 나오는 '순서 나열' 문제 훈련이에요.</p>
      <h2 class="plan-q">시대</h2>
      <div class="chips is-wrap">
        <button type="button" class="chip ${era ? '' : 'is-active'}" data-era="">전체</button>
        ${eras.map(x => `<button type="button" class="chip ${era === x ? 'is-active' : ''}" data-era="${esc(x)}">${esc(x)} <span class="muted">${events.filter(e => e.era === x).length}</span></button>`).join('')}
      </div>
      <button type="button" class="btn btn-primary btn-block mt" data-act="start">${ROUNDS}문제 시작</button>
      ${best.plays ? `<p class="muted small mt">지금까지 ${best.plays}판 · 최고 ${best.best}/${ROUNDS}</p>` : ''}
    </section>`;
  }

  function roundHTML() {
    const r = game.rounds[game.i];
    const answer = [...r.items].sort((a, b) => keyOf(a) - keyOf(b));
    const cards = r.items.map((e, k) => {
      const at = r.taps.indexOf(k);
      const right = r.done ? answer.indexOf(e) : -1;
      const cls = ['order-card', at >= 0 ? 'is-picked' : '', r.done ? (at === right ? 'is-ok' : 'is-bad') : ''].join(' ');
      return `<button type="button" class="${cls}" data-k="${k}" ${r.done ? 'disabled' : ''}>
        <span class="order-badge">${at >= 0 ? at + 1 : ''}</span>
        <span class="grow"><b>${LABELS[k]} ${esc(e.name)}</b>${r.done ? `<small>${yearText(e)} · ${right + 1}번째${e.note ? ` · ${esc(e.note)}` : ''}</small>` : ''}</span>
      </button>`;
    }).join('');
    const last = game.i === game.rounds.length - 1;
    return `<section class="card">
      <div class="card-title"><span>${game.i + 1} / ${game.rounds.length} · ${esc(r.items[0].era)}</span>
        <span class="muted small">맞힌 문제 ${game.rounds.filter(x => x.done && x.ok).length}</span></div>
      <p class="q-text">(가)~(라)를 일어난 순서대로 눌러 주세요.</p>
      <div class="stack">${cards}</div>
      ${r.done
        ? `<p class="order-result ${r.ok ? 'is-ok' : 'is-bad'}">${r.ok ? '정답이에요!' : `정답: ${answer.map(e => LABELS[r.items.indexOf(e)]).join(' → ')}`}</p>
           <button type="button" class="btn btn-primary btn-block" data-act="${last ? 'finish' : 'next'}">${last ? '결과 보기' : '다음 문제'}</button>`
        : `<button type="button" class="btn btn-ghost btn-block mt" data-act="undo" ${r.taps.length ? '' : 'disabled'}>하나 되돌리기</button>`}
    </section>`;
  }

  function endHTML() {
    const ok = game.rounds.filter(r => r.ok).length;
    return `<section class="card summary">
      <p class="score-big">${ok}<span class="score-of"> / ${game.rounds.length}</span></p>
      <p class="muted small">${ok === game.rounds.length ? '완벽해요! 순서 문제는 걱정 없어요.' : '틀린 문제의 연도를 한 번 더 보고 다시 도전해 보세요.'}</p>
    </section>
    <div class="stack">
      <button type="button" class="btn btn-primary btn-block" data-act="start">같은 시대로 다시</button>
      <button type="button" class="btn btn-ghost btn-block" data-act="setup">시대 바꾸기</button>
    </div>`;
  }

  function draw() {
    let body = '<p class="loading">불러오는 중…</p>';
    if (events.length && !game) body = setupHTML();
    else if (game?.over) body = endHTML();
    else if (game) body = roundHTML();
    el.innerHTML = `<header class="page-head"><div><a class="back" href="#/">← 홈</a><h1>순서 맞히기</h1></div></header>${body}`;
  }

  el.addEventListener('click', e => {
    const chip = e.target.closest('[data-era]');
    const card = e.target.closest('[data-k]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (chip) {
      era = chip.dataset.era;
      draw();
    } else if (card && game) {
      const r = game.rounds[game.i];
      const k = Number(card.dataset.k);
      if (r.done || r.taps.includes(k)) return;
      r.taps.push(k);
      if (r.taps.length === PICK) {
        const answer = [...r.items].sort((a, b) => keyOf(a) - keyOf(b));
        r.done = true;
        r.ok = r.taps.every((t, idx) => r.items[t] === answer[idx]);
      }
      draw();
    } else if (act === 'undo' && game) {
      game.rounds[game.i].taps.pop();
      draw();
    } else if (act === 'next') {
      game.i += 1;
      draw();
      window.scrollTo(0, 0);
    } else if (act === 'finish') {
      const ok = game.rounds.filter(r => r.ok).length;
      const best = loadBest();
      try { localStorage.setItem(BEST_KEY, JSON.stringify({ plays: (best.plays ?? 0) + 1, best: Math.max(best.best ?? 0, ok) })); } catch { /* 이번만 */ }
      game.over = true;
      draw();
    } else if (act === 'start') {
      startGame();
    } else if (act === 'setup') {
      game = null;
      draw();
    }
  });

  draw();
  fetch('data/events.json')
    .then(res => (res.ok ? res.json() : []))
    .then(list => {
      events = Array.isArray(list) ? list.filter(x => x.name && Number.isInteger(x.year) && x.era) : [];
      if (!events.length) el.innerHTML = '<header class="page-head"><h1>순서 맞히기</h1></header><div class="card empty"><p>사건 데이터를 준비하고 있어요.</p><a class="btn btn-primary" href="#/">홈으로</a></div>';
      else draw();
    })
    .catch(() => {});
}
