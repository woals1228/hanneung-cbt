// 홈: 전야제·기념일 카드, D-day, 연속 학습, 오늘의 문제, 복습, 바로 풀기
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, dateOverride, daysBetween, formatLong, formatShort, dday } from '../dates.js';
import { esc, questionHTML, explanationHTML, installInfo, promptInstall, toast } from '../ui.js';
import { track } from '../track.js';

const INSTALL_DISMISSED = 'hcbt.installDismissed';

export function render(el) {
  const today = todayStr();

  function draw() {
    el.innerHTML = `
      ${headerHTML(today)}
      ${specialCardsHTML(today)}
      ${tilesHTML(today)}
      <section class="card" id="daily">${dailyHTML(today)}</section>
      ${reviewHTML(today)}
      ${shortcutsHTML()}
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
      store.recordAnswer(q.id, state.choice === q.answer, 'daily', Boolean(state.viewed));
      track('answer');
      draw();
      el.querySelector('#daily .explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  return `<header class="home-head">
    <div><p class="date">${formatLong(today)}</p><h1>한국사 CBT</h1></div>
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

function tilesHTML(today) {
  const exam = data.nextExam(today);
  const examTile = exam
    ? `<div class="card tile">
        <p class="tile-label">제${exam.round}회 한능검 (${esc(exam.level)})</p>
        <p class="tile-value">${dday(daysBetween(today, exam.date))}</p>
        <p class="tile-sub">${formatShort(exam.date)} 시험${exam.apply ? `<br>접수 ${esc(exam.apply)}` : ''}</p>
      </div>`
    : `<div class="card tile">
        <p class="tile-label">다음 시험</p>
        <p class="tile-value">—</p>
        <p class="tile-sub">일정이 아직 없어요</p>
      </div>`;
  const s = store.streak(today);
  let sub = '오늘 첫 문제를 풀어 보세요';
  if (s.doneToday) sub = '오늘 공부 완료!';
  else if (s.count) sub = `오늘 풀면 ${s.count + 1}일째`;
  return `<div class="tiles">
    ${examTile}
    <div class="card tile">
      <p class="tile-label">연속 학습</p>
      <p class="tile-value">🔥 ${s.count}일</p>
      <p class="tile-sub">${sub}</p>
    </div>
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

function reviewHTML(today) {
  const due = store.dueIds(today).filter(id => data.getQuestion(id));
  return `<section class="card row-card">
    <div class="grow">
      <b>오답 복습</b>
      <p class="muted small">${due.length ? `오늘 다시 풀 문제가 ${due.length}개 있어요` : '오늘 복습할 문제가 없어요 👍'}</p>
    </div>
    ${due.length
      ? '<a class="btn btn-primary btn-sm" href="#/quiz?mode=review">복습 시작</a>'
      : '<a class="btn btn-ghost btn-sm" href="#/notebook">오답노트</a>'}
  </section>`;
}

function shortcutsHTML() {
  return `
    <h2 class="section-title">바로 풀기</h2>
    <div class="shortcuts">
      <a class="shortcut" href="#/quiz?mode=more"><span class="shortcut-icon">⚡</span><b>문제 더 풀기</b><span>안 푼 문제 3개</span></a>
      <a class="shortcut" href="#/exam"><span class="shortcut-icon">📝</span><b>실전 모의고사</b><span>50문항 · 80분 CBT</span></a>
      <a class="shortcut shortcut-wide" href="#/hot"><span class="shortcut-icon">🎯</span><b>81회 빈출 예측</b><span>57~80회 24번 분석 · 최근 늘어난 주제</span></a>
    </div>
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
    ? 'Safari 아래쪽 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있어요.'
    : '설치하면 아이콘을 눌러 바로 열 수 있고, 인터넷이 없어도 풀 수 있어요.';
  return `<section class="card install">
    <div class="grow"><b>홈 화면에 추가하기</b><p class="muted small">${text}</p></div>
    <div class="row">
      ${info.canPrompt ? '<button type="button" class="btn btn-primary btn-sm" data-act="install">설치</button>' : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-act="dismiss-install">닫기</button>
    </div>
  </section>`;
}
