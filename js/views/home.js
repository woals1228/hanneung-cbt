// 홈: 수험생(20~30대 공시생·취준생 중심)이 바로 쓰는 순서
//  목표 급수와 내 실력 → 오늘의 공부 3가지 → 도구 → 오늘의 문제 → 시대별·기념일
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, dateOverride, daysBetween, formatLong, formatShort, dday } from '../dates.js';
import { esc, questionHTML, explanationHTML, installInfo, promptInstall, toast } from '../ui.js';
import { track, logAnswers } from '../track.js';

const INSTALL_DISMISSED = 'hcbt.installDismissed';
const GOAL_KEY = 'hcbt.goal';
// 심화 합격선: 1급 80점, 2급 70점, 3급 60점
const CUTS = { 1: 80, 2: 70, 3: 60 };

function getGoal() {
  try { return Number(localStorage.getItem(GOAL_KEY)) || null; } catch { return null; }
}

export function render(el) {
  const today = todayStr();

  function draw() {
    el.innerHTML = `
      ${headerHTML(today)}
      ${specialCardsHTML(today)}
      ${goalHTML(today)}
      ${todayHTML(today)}
      ${toolsHTML()}
      <section class="card" id="daily">${dailyHTML(today)}</section>
      ${erasHTML()}
      ${upcomingHTML(today)}
      <div id="install-slot">${installHTML()}</div>`;
  }

  draw();

  el.addEventListener('click', async e => {
    // 오늘의 1문제: 고르면 저장만(정답 숨김) → [해설] 또는 [채점하기]
    const q = data.dailyQuestion(today);
    const daily = store.dailyFor(today);
    const state = daily?.q === q.id ? daily : null;
    const choice = e.target.closest('#daily [data-choice]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (choice && !state?.graded) {
      store.setDaily(today, q.id, { choice: Number(choice.dataset.choice) });
      draw();
    } else if (act === 'daily-explain' && !state?.viewed) {
      store.setDaily(today, q.id, { viewed: true });
      track('explain_open');
      draw();
      el.querySelector('#daily .explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (act === 'daily-grade' && state?.choice && !state.graded) {
      store.setDaily(today, q.id, { graded: true });
      store.recordAnswer(q.id, state.choice === q.answer, 'daily', Boolean(state.viewed), state.choice);
      logAnswers('daily', [{ q, pick: state.choice, ok: state.choice === q.answer, viewed: Boolean(state.viewed) }]);
      track('answer');
      draw();
      el.querySelector('#daily .explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (act === 'go-daily') {
      el.querySelector('#daily').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (e.target.closest('[data-goal]')) {
      try { localStorage.setItem(GOAL_KEY, e.target.closest('[data-goal]').dataset.goal); } catch { /* 이번만 적용돼요 */ }
      draw();
    } else if (act === 'install') {
      if (await promptInstall()) toast('홈 화면에 설치했어요!');
      el.querySelector('#install-slot').innerHTML = installHTML();
    } else if (act === 'dismiss-install') {
      try { localStorage.setItem(INSTALL_DISMISSED, '1'); } catch { /* 다음에 다시 보여도 괜찮아요 */ }
      el.querySelector('#install-slot').innerHTML = '';
    }
  });

  const onInstallable = () => { el.querySelector('#install-slot').innerHTML = installHTML(); };
  document.addEventListener('installable', onInstallable);
  return () => document.removeEventListener('installable', onInstallable);
}

function headerHTML(today) {
  const exam = data.nextExam(today);
  return `<header class="home-head">
    <div><p class="date">${formatLong(today)}</p><h1>한국사 CBT</h1>
      <p class="home-tag">${exam ? `제${exam.round}회 ` : ''}한능검 심화 준비</p></div>
    ${dateOverride() ? '<a class="test-badge" href="#/settings">🧪 테스트 날짜</a>' : ''}
  </header>`;
}

// 시험 전날·당일 전야제 카드, 기념일 당일 또는 3일 전 카드
function specialCardsHTML(today) {
  const cards = [];
  const exam = data.nextExam(today);
  if (exam) {
    const days = daysBetween(today, exam.date);
    const count = data.eveQuestions(exam, today).length;
    if (days === 1 || days === 0) {
      const eve = days === 1;
      cards.push(`<section class="card card-eve">
        <p class="eyebrow">${eve ? '🔥 전야제' : '💪 시험 당일'}</p>
        <h2>${eve ? `내일은 제${exam.round}회 한능검!` : `오늘은 제${exam.round}회 시험 날!`}</h2>
        <p>${eve ? '시험에 자주 나오는 주제만 모았어요. 마지막으로 한 번 더 풀어 보세요.' : '시험장 가기 전에 빈출 주제를 가볍게 훑어보세요.'}</p>
        ${count ? `<a class="btn btn-inverse btn-block" href="#/quiz?mode=eve">전야제 문제 ${count}개 풀기</a>` : ''}
      </section>`);
    }
  }

  const anniv = data.anniversaryOn(today);
  if (anniv) {
    cards.push(annivCardHTML(anniv, today, `오늘 · ${formatShort(today)}`, `오늘은 ${anniv.name} ${anniv.emoji ?? ''}`, '기념일 퀴즈 풀기'));
  } else {
    const soon = data.upcomingAnniversaries(today, 1)[0];
    if (soon && soon.days <= 3) {
      cards.push(annivCardHTML(soon, today, formatShort(soon.on), `${dday(soon.days)} ${soon.name}`, '미리 풀어 보기'));
    }
  }
  return cards.join('');
}

function annivCardHTML(anniv, today, eyebrow, title, cta) {
  const count = data.anniversaryQuestions(anniv, today).length;
  return `<section class="card card-anniv">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h2>${esc(title.trim())}</h2>
    <p>${esc(anniv.desc)}</p>
    ${count ? `<a class="btn btn-primary btn-block" href="#/quiz?mode=anniv&date=${anniv.date}">${cta} (${count})</a>` : ''}
  </section>`;
}

// 가장 최근 실력: 모의고사 점수 또는 과거 시험 10문항 정답률
function latestScore() {
  const r = [...store.getState().exams].reverse().find(x => x.mode === 'exam' || x.kind === 'test');
  if (!r) return null;
  return r.mode === 'exam'
    ? { score: r.score, label: '모의고사' }
    : { score: Math.round((r.correct / (r.scored || 1)) * 100), label: '10문항 진단' };
}

// 목표 카드: D-day, 목표 급수, 합격선 위에 내 실력
function goalHTML(today) {
  const exam = data.nextExam(today);
  const goal = getGoal();
  const cut = CUTS[goal];
  const last = latestScore();
  let msg = '목표 급수를 고르면 남은 점수를 알려 드려요.';
  if (last && cut) msg = last.score >= cut ? `목표 ${goal}급 합격선을 넘었어요. 이 실력을 지켜요.` : `목표 ${goal}급까지 <b>${cut - last.score}점</b> 남았어요.`;
  else if (last) msg = `최근 ${last.label} ${last.score}점이에요.`;
  else if (cut) msg = `목표 ${goal}급은 ${cut}점 이상이에요. 지금 실력부터 재 볼까요?`;
  const marks = Object.entries(CUTS).map(([g, c]) => `<span class="goal-mark ${Number(g) === goal ? 'is-goal' : ''}" style="left:${c}%"><i></i>${g}급</span>`).join('');
  return `<section class="card goal">
    <div class="goal-top">
      <div>
        <p class="goal-label">${exam ? `제${exam.round}회 ${esc(exam.level)} · ${formatShort(exam.date)}` : '다음 시험 일정 대기'}</p>
        <p class="goal-dday">${exam ? dday(daysBetween(today, exam.date)) : '—'}</p>
      </div>
      <div class="goal-pick" role="group" aria-label="목표 급수">
        ${[1, 2, 3].map(g => `<button type="button" data-goal="${g}" aria-pressed="${g === goal}" class="${g === goal ? 'is-on' : ''}">${g}급</button>`).join('')}
      </div>
    </div>
    <div class="goal-track" aria-hidden="true">
      <div class="goal-fill" style="width:${last ? Math.min(100, last.score) : 0}%"></div>
      ${marks}
    </div>
    <p class="goal-msg">${msg}${last && cut ? ` <span>(${last.label} ${last.score}점)</span>` : ''}</p>
    <a class="btn btn-block goal-btn" href="#/quiz?mode=test">${last ? '10문항으로 다시 재기' : '10문항으로 실력 재기'} · 약 5분</a>
  </section>`;
}

// 오늘의 공부: 1문제, 오답 복습, 빈출 세트. 끝낸 것은 체크로 보여요.
function todayHTML(today) {
  const daily = store.dailyFor(today);
  const dailyDone = daily?.q === data.dailyQuestion(today).id && daily.graded;
  const due = store.dueIds(today).filter(id => data.getQuestion(id)).length;
  const attempts = store.getState().attempts.filter(a => a.day === today);
  const hotDone = attempts.some(a => a.mode === 'hot');
  const items = [
    { done: dailyDone, title: '오늘의 1문제', sub: dailyDone ? '풀었어요' : '1분이면 끝나요', attrs: 'data-act="go-daily"' },
    { done: due === 0, title: '오답 복습', sub: due ? `다시 풀 문제 ${due}개` : '오늘은 복습할 문제가 없어요', attrs: due ? 'href="#/quiz?mode=review"' : 'href="#/notebook"' },
    { done: hotDone, title: '빈출 예상 10문제', sub: '81회에 나올 만한 주제부터', attrs: 'href="#/quiz?mode=hot"' },
  ];
  const s = store.streak(today);
  const row = it => {
    const tag = it.attrs.startsWith('href') ? 'a' : 'button';
    return `<li><${tag} class="todo ${it.done ? 'is-done' : ''}" ${tag === 'button' ? 'type="button" ' : ''}${it.attrs}>
      <span class="todo-check" aria-hidden="true">${it.done ? '✓' : ''}</span>
      <span class="grow"><b>${it.title}</b><small>${it.sub}</small></span><span class="muted" aria-hidden="true">›</span></${tag}></li>`;
  };
  return `<section class="card">
    <div class="card-title"><span>오늘의 공부 <span class="muted">${items.filter(i => i.done).length}/3</span></span>
      <span class="muted small">오늘 ${attempts.length}문제 · 연속 ${s.count}일</span></div>
    <ul class="list">${items.map(row).join('')}</ul>
  </section>`;
}

function toolsHTML() {
  const past = data.pastExams().length;
  const tool = (href, title, sub) => `<a class="tool" href="${href}"><b>${title}</b><span>${sub}</span></a>`;
  return `<div class="tools">
    ${tool('#/exam', past ? '기출·모의고사' : '실전 모의고사', past ? `기출 ${past}회분 · 50문항 80분` : '50문항 · 80분')}
    ${tool('#/hot', '81회 빈출 예측', '57~80회 24번 분석')}
    ${tool('#/quiz?mode=test', '과거 시험 10문항', '급제 칭호·홍패')}
    ${tool('#/quiz?mode=more', '문제 더 풀기', '안 푼 문제부터 3개')}
  </div>`;
}

function dailyHTML(today) {
  const q = data.dailyQuestion(today);
  const daily = store.dailyFor(today);
  const state = daily?.q === q.id ? daily : {};
  const actions = state.graded
    ? '<a class="btn btn-ghost btn-block mt" href="#/quiz?mode=more">⚡ 3문제 더 풀기</a>'
    : `<div class="exam-nav">
        <button type="button" class="btn btn-ghost" data-act="daily-explain" ${state.viewed ? 'disabled' : ''}>해설</button>
        <button type="button" class="btn btn-primary" data-act="daily-grade" ${state.choice ? '' : 'disabled'} style="grid-column: span 2">채점하기</button>
      </div>`;
  return `
    <div class="card-title"><span>오늘의 문제</span><span class="muted small">${formatShort(today)}</span></div>
    ${questionHTML(q, { selected: state.choice ?? null, revealed: Boolean(state.graded) })}
    ${state.viewed && !state.graded ? explanationHTML(q, null) : ''}
    ${state.viewed ? '<p class="muted small mt">해설을 보고 푼 문제는 정답률에 넣지 않아요.</p>' : ''}
    ${actions}`;
}

function erasHTML() {
  return `
    <h2 class="section-title">시대별로 풀기</h2>
    <div class="chips">
      ${data.ERAS.map(era => `<a class="chip" href="#/quiz?mode=era&era=${encodeURIComponent(era)}">${esc(era)}</a>`).join('')}
    </div>`;
}

function upcomingHTML(today) {
  const list = data.upcomingAnniversaries(today, 4).filter(a => a.days > 0);
  const rows = list.map(a => {
    const inner = `<div class="grow"><b>${esc(a.name)}</b><p class="muted small">${formatShort(a.on)}</p></div><span class="dday">${dday(a.days)}</span>`;
    return data.anniversaryQuestions(a, today).length
      ? `<li><a class="list-row link-row" href="#/quiz?mode=anniv&date=${a.date}">${inner}</a></li>`
      : `<li><div class="list-row">${inner}</div></li>`;
  }).join('');
  return `<h2 class="section-title">다가오는 기념일</h2><section class="card"><ul class="list">${rows}</ul></section>`;
}

function installHTML() {
  const info = installInfo();
  let dismissed = false;
  try { dismissed = localStorage.getItem(INSTALL_DISMISSED) === '1'; } catch { /* 무시 */ }
  if (info.standalone || dismissed || !(info.canPrompt || info.ios)) return '';
  const text = info.ios
    ? 'Safari 공유 버튼(□↑, 안 보이면 ⋯ 안) → "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있어요.'
    : '설치하면 아이콘을 눌러 바로 열 수 있고, 인터넷이 없어도 풀 수 있어요.';
  return `<section class="card install">
    <div class="grow"><b>홈 화면에 추가하기</b><p class="muted small">${text}</p></div>
    <div class="row">
      ${info.canPrompt ? '<button type="button" class="btn btn-primary btn-sm" data-act="install">설치</button>' : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-act="dismiss-install">닫기</button>
    </div>
  </section>`;
}
