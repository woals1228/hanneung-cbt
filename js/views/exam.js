// 문제 풀이 화면 — 학습 모드와 시험 모드가 같은 화면을 써요.
//  공통: 한 화면에 한 문제, 누르면 바로 저장(정답은 숨김), 하단 [이전][해설][다음], 마지막에 한 번에 채점.
//  시험 모드 (#/exam/…): 실전 모의고사. 타이머가 있고 제출 전에는 해설이 잠겨요.
//  학습 모드 (#/solve/…): 오늘의 문제·기념일·시대별·오답 다시 풀기. 해설을 언제든 볼 수 있어요.
import * as data from '../data.js';
import * as store from '../store.js';
import { formatShort, toDateStr, todayStr } from '../dates.js';
import { esc, questionHTML, explanationHTML, shuffle, confirmModal, closeModal, barRowHTML, toast, CIRCLED } from '../ui.js';
import { track } from '../track.js';

const GRADES = [[80, '1급'], [70, '2급'], [60, '3급']];
const gradeOf = score => GRADES.find(([min]) => score >= min)?.[1] ?? '불합격';
const LOW_TIME_SEC = 300;
const BASE = { exam: '#/exam', study: '#/solve' };

export function render(el, route) {
  const mode = route.name === 'solve' ? 'study' : 'exam';
  const [sub, id] = route.parts;
  if (sub === 'run') return renderRun(el, mode);
  if (sub === 'result') return renderResult(el, id);
  if (mode === 'exam') return renderLobby(el);
  location.replace('#/');
}

// 시간은 시작 시각 기준이라 앱을 닫아도 계속 흘러요.
const remainingSec = draft => Math.max(0, Math.round(draft.limit - (Date.now() - draft.started) / 1000));
const clock = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
const duration = sec => (sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`);
// 실제 시험(50문항 80분)과 같은 비율로 시간을 정해요.
const limitSec = count => Math.max(10, Math.round((data.EXAM_MINUTES * count) / data.EXAM_SIZE)) * 60;

// 새 풀이를 시작해요. key가 같은 학습 풀이가 남아 있으면 quiz.js가 이어서 풀게 해요.
export function startSession(mode, { title, ids, kind, key }, { replace = false } = {}) {
  store.saveDraft(mode, {
    mode, title, kind, key, ids, answers: {}, viewed: {}, current: 0,
    started: Date.now(), limit: mode === 'exam' ? limitSec(ids.length) : null,
  });
  const target = `${BASE[mode]}/run`;
  if (replace) location.replace(target);
  else location.hash = target;
}

function finish(draft) {
  if (store.getDraft(draft.mode) !== draft) return; // 이미 채점했어요.
  const questions = draft.ids.map(id => data.getQuestion(id)).filter(Boolean);
  let earned = 0;
  let possible = 0;
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let viewedCount = 0;
  for (const q of questions) {
    const pick = draft.answers[q.id] ?? null;
    const ok = pick === q.answer;
    const viewed = Boolean(draft.viewed?.[q.id]);
    if (pick == null) blank += 1;
    else if (ok) correct += 1;
    else wrong += 1;
    if (viewed) viewedCount += 1;
    else {
      possible += q.points;
      if (ok) earned += q.points;
    }
    // 학습 모드에서 안 푼 문제는 기록하지 않아요. 시험 모드에서는 틀린 것으로 봐요.
    if (pick != null || draft.mode === 'exam') store.recordAnswer(q.id, ok, draft.kind ?? draft.mode, viewed);
  }
  const scoredCorrect = questions.filter(q => !draft.viewed?.[q.id] && draft.answers[q.id] === q.answer).length;
  const scored = questions.length - viewedCount;
  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const result = {
    id: String(Date.now()),
    at: Date.now(),
    mode: draft.mode,
    kind: draft.kind,
    title: draft.title,
    ids: questions.map(q => q.id),
    answers: { ...draft.answers },
    viewed: { ...(draft.viewed ?? {}) },
    score,
    grade: draft.mode === 'exam' ? gradeOf(score) : null,
    correct: scoredCorrect,
    scored,
    wrong,
    blank,
    viewedCount,
    total: questions.length,
    sec: Math.round((Date.now() - draft.started) / 1000),
  };
  if (draft.limit) result.sec = Math.min(draft.limit, result.sec);
  store.addResult(result);
  if (correct + wrong > 0) track('answer');
  if (draft.kind === 'eve') track('eve_submit');
  location.replace(`${BASE[draft.mode]}/result/${result.id}`);
}

const examHistory = () => store.getState().exams.filter(r => r.mode !== 'study');

// 기출(개인용 앱에만 있어요). 공개 앱에서는 공식 자료실 링크를 보여 줘요.
function pastHTML() {
  const exams = data.pastExams();
  if (!exams.length) {
    return `<section class="card">
      <h2 class="card-title">기출 문제</h2>
      <p class="muted small">회차별 기출 문제는 국사편찬위원회 자료실에서 받을 수 있어요.</p>
      <a class="btn btn-ghost btn-block mt" href="https://www.historyexam.go.kr/pst/list.do?bbs=dat" target="_blank" rel="noopener" data-out>공식 기출 자료실 열기</a>
    </section>`;
  }
  return `<h2 class="section-title">기출 문제 <span class="muted">· ${exams.length}회분</span></h2>
    <section class="card">
      <button type="button" class="btn btn-primary btn-block" data-act="past">🎲 랜덤 기출 모의고사</button>
      <p class="muted small mt">번호마다 ${exams.length}개 회차 중 한 문제를 골라 50문항을 만들어요.</p>
      <button type="button" class="btn btn-ghost btn-block mt" data-act="past-download">📥 기출 ${exams.length}회분 폰에 저장(오프라인용)</button>
      <div class="chips is-wrap mt">${exams.map(x => `<button type="button" class="chip" data-act="past" data-exam="${x.id}">${x.round}회</button>`).join('')}</div>
      <p class="muted small mt">이 기출문제는 국사편찬위원회가 작성한 '한국사능력검정시험 심화 기출문제'(제${exams.at(-1).round}~${exams[0].round}회)를 이용했으며, <a href="https://www.historyexam.go.kr/pst/list.do?bbs=dat" target="_blank" rel="noopener">국사편찬위원회 한국사능력검정시험 누리집</a>에서 무료로 받을 수 있어요. 저작권은 국사편찬위원회와 원저작자에게 있으며, 요청하시면 바로 내릴게요(wjswoals1228@naver.com).</p>
    </section>`;
}

// 기출 이미지를 모두 받아 두면 서비스 워커가 hcbt-past 캐시에 넣어요(PC가 꺼져도 풀 수 있게).
async function downloadPast(btn) {
  const urls = data.pastImageUrls();
  const cache = await caches.open('hcbt-past');
  let done = 0;
  btn.disabled = true;
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(urls.slice(i, i + 8).map(async url => {
      if (!(await cache.match(url))) {
        const res = await fetch(url).catch(() => null);
        if (res?.ok) await cache.put(url, res);
      }
      done += 1;
    }));
    btn.textContent = `📥 저장 중 ${done} / ${urls.length}`;
  }
  await Promise.all(['data/past-exams.json', 'data/past-questions.json'].map(u => fetch(u).then(r => r.ok && cache.put(u, r)).catch(() => {})));
  btn.textContent = '✅ 기출을 폰에 모두 저장했어요';
}

function renderLobby(el) {
  const draft = store.getDraft('exam');
  if (draft && remainingSec(draft) === 0) {
    finish(draft);
    return;
  }
  const count = Math.min(data.examPool(todayStr()).length, data.EXAM_SIZE);
  const history = [...examHistory()].reverse();

  el.innerHTML = `
    <header class="page-head"><h1>실전 모의고사</h1></header>
    ${draft ? `<section class="card card-eve">
      <p class="eyebrow">풀던 시험이 있어요</p>
      <h2>${Object.keys(draft.answers).length} / ${draft.ids.length}문항 풀었어요</h2>
      <p>남은 시간 ${clock(remainingSec(draft))} · 나가 있는 동안에도 시간은 흘러요.</p>
      <div class="row">
        <a class="btn btn-inverse grow" href="#/exam/run">이어서 풀기</a>
        <button type="button" class="btn btn-ghost-inverse" data-act="restart">새로 시작</button>
      </div>
    </section>` : ''}
    <section class="card">
      <h2 class="card-title">시험 안내</h2>
      <dl class="facts">
        <div><dt>문항</dt><dd>${count}문항 · 5지 택1${count < data.EXAM_SIZE ? ' <span class="muted small">(지금 있는 문제 수만큼)</span>' : ''}</dd></div>
        <div><dt>시간</dt><dd>${limitSec(count) / 60}분 <span class="muted small">(실제 시험 ${data.EXAM_SIZE}문항 ${data.EXAM_MINUTES}분 기준)</span></dd></div>
        <div><dt>배점</dt><dd>문항별 1~3점, 100점 만점으로 환산</dd></div>
        <div><dt>급수</dt><dd>80점 이상 1급 · 70점 이상 2급 · 60점 이상 3급</dd></div>
      </dl>
      <p class="muted small">시험 모드에서는 제출 전에 정답과 해설을 볼 수 없어요. 제출하면 채점하고, 틀린 문제는 오답노트에 들어가요.</p>
      ${draft ? '' : '<button type="button" class="btn btn-primary btn-block mt" data-act="start">시험 시작</button>'}
    </section>
    ${pastHTML()}
    <h2 class="section-title">지난 기록</h2>
    <section class="card">
      ${history.length ? `<ul class="list">${history.map(r => `<li>
        <a class="list-row link-row" href="#/exam/result/${r.id}">
          <div class="grow">
            <b>${r.score}점</b><span class="grade-chip ${r.grade === '불합격' ? 'is-fail' : ''}">${r.grade}</span>
            <p class="muted small">${formatShort(toDateStr(new Date(r.at)))} · ${r.total}문항 중 ${r.correct}개 정답</p>
          </div>
          <span class="muted" aria-hidden="true">›</span>
        </a></li>`).join('')}</ul>` : '<p class="muted">아직 본 시험이 없어요.</p>'}
    </section>`;

  const start = () => startSession('exam', { title: '실전 모의고사', ids: data.buildExamSet(shuffle, todayStr()), kind: 'exam' });
  const startPast = async btn => {
    if (draft && !(await confirmModal({ title: '새 시험을 시작할까요?', message: '풀던 시험은 채점하지 않고 지워져요.', ok: '새로 시작', danger: true }))) return;
    const examId = btn.dataset.exam;
    const ids = examId ? data.pastExamIds(examId) : data.randomPastSet(list => list[Math.floor(Math.random() * list.length)]);
    const title = examId ? `제${data.pastExams().find(x => x.id === examId).round}회 심화 기출` : '랜덤 기출 모의고사';
    startSession('exam', { title, ids, kind: 'past' });
  };
  el.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'past') startPast(e.target.closest('[data-act]'));
    if (act === 'past-download') downloadPast(e.target.closest('[data-act]'));
    if (act === 'start') start();
    if (act === 'restart') {
      const ok = await confirmModal({ title: '새로 시작할까요?', message: '풀던 시험은 채점하지 않고 지워져요.', ok: '새로 시작', danger: true });
      if (ok) start();
    }
  });
}

function renderRun(el, mode) {
  const draft = store.getDraft(mode);
  if (!draft) {
    location.replace(mode === 'exam' ? '#/exam' : '#/');
    return;
  }
  document.body.classList.add('focus-mode');
  const exam = mode === 'exam';
  const total = draft.ids.length;
  let showExplain = false;

  function draw() {
    const q = data.getQuestion(draft.ids[draft.current]);
    const answered = Object.keys(draft.answers).length;
    const left = exam ? remainingSec(draft) : 0;
    const last = draft.current === total - 1;
    const viewed = Boolean(draft.viewed?.[q.id]);
    el.innerHTML = `
      <div class="exam-bar">
        ${exam
          ? `<span class="timer ${left <= LOW_TIME_SEC ? 'is-low' : ''}" id="timer" role="timer" aria-label="남은 시간">⏱ ${clock(left)}</span>`
          : '<button type="button" class="back" data-act="leave">← 나가기</button>'}
        <span class="exam-count">${draft.current + 1}번 / ${total}번 · 푼 문제 ${answered}</span>
        <button type="button" class="btn btn-ghost btn-sm fav-btn ${store.isFavorite(q.id) ? 'is-on' : ''}" data-act="fav" aria-pressed="${store.isFavorite(q.id)}" aria-label="즐겨찾기">${store.isFavorite(q.id) ? '★' : '☆'}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="sheet">답안표</button>
        <button type="button" class="btn btn-primary btn-sm" data-act="submit">${exam ? '제출' : '채점'}</button>
      </div>
      <div class="progress" aria-hidden="true"><span style="width:${(answered / total) * 100}%"></span></div>
      ${exam ? '' : `<p class="muted small mt">${esc(draft.title)}${viewed ? ' · <span class="due-today">해설 보고 푼 문제</span>' : ''}</p>`}
      <section class="card mt">
        ${questionHTML(q, { number: draft.current + 1, selected: draft.answers[q.id] ?? null, showPoints: exam })}
        ${showExplain ? explanationHTML(q, null) : ''}
      </section>
      <div class="exam-nav is-fixed">
        <button type="button" class="btn btn-ghost" data-act="prev" ${draft.current === 0 ? 'disabled' : ''}>← 이전</button>
        <button type="button" class="btn btn-ghost ${exam ? 'is-locked' : ''}" data-act="explain" aria-disabled="${exam}">${exam ? '🔒 해설' : showExplain ? '해설 닫기' : '해설'}</button>
        ${last
          ? `<button type="button" class="btn btn-primary" data-act="submit">${exam ? '제출' : '채점하기'}</button>`
          : '<button type="button" class="btn btn-primary" data-act="next">다음 →</button>'}
      </div>`;
  }

  function go(to) {
    draft.current = to;
    showExplain = false;
    store.saveDraft(mode, draft);
    draw();
    window.scrollTo(0, 0);
  }

  function openSheet() {
    const answered = Object.keys(draft.answers).length;
    const root = document.getElementById('modal-root');
    const cells = draft.ids.map((qid, i) => {
      const a = draft.answers[qid];
      return `<button type="button" class="sheet-cell ${a ? 'is-done' : ''} ${i === draft.current ? 'is-current' : ''}" data-jump="${i}" aria-label="${i + 1}번 ${a ? `${a}번 선택` : '안 풂'}">
        <span>${i + 1}</span><b>${a ? CIRCLED[a - 1] : '·'}</b></button>`;
    }).join('');
    root.innerHTML = `
      <div class="modal-backdrop" data-close>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div class="row between"><h2 id="sheet-title">답안표</h2><span class="muted small">푼 문제 ${answered} / ${total} · 안 푼 문제 ${total - answered}</span></div>
          <div class="sheet-grid">${cells}</div>
          <button type="button" class="btn btn-ghost btn-block mt" data-close>닫기</button>
        </div>
      </div>`;
    root.firstElementChild.addEventListener('click', e => {
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        closeModal();
        go(Number(jump.dataset.jump));
      } else if (e.target.matches('[data-close]')) {
        closeModal();
      }
    });
  }

  async function submit() {
    const left = total - Object.keys(draft.answers).length;
    const ok = await confirmModal({
      title: exam ? '답안을 제출할까요?' : '채점할까요?',
      message: left
        ? `아직 안 푼 문제가 ${left}개 있어요.${exam ? ' 안 푼 문제는 틀린 것으로 채점돼요.' : ''}`
        : '채점하면 이 풀이는 끝나요.',
      ok: '채점하기',
    });
    if (ok) finish(draft);
  }

  el.addEventListener('click', e => {
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      draft.answers[draft.ids[draft.current]] = Number(choice.dataset.choice);
      store.saveDraft(mode, draft);
      draw();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev' && draft.current > 0) go(draft.current - 1);
    else if (act === 'next' && draft.current < total - 1) go(draft.current + 1);
    else if (act === 'sheet') openSheet();
    else if (act === 'fav') {
      const on = store.toggleFavorite(draft.ids[draft.current]);
      if (on) track('fav');
      toast(on ? '즐겨찾기에 넣었어요 (오답노트 ★ 탭)' : '즐겨찾기에서 뺐어요');
      draw();
    }
    else if (act === 'submit') submit();
    else if (act === 'leave') location.hash = '#/';
    else if (act === 'explain') {
      if (exam) {
        toast('시험 모드에서는 제출한 뒤에 해설을 볼 수 있어요');
        return;
      }
      showExplain = !showExplain;
      if (showExplain) {
        draft.viewed = { ...(draft.viewed ?? {}), [draft.ids[draft.current]]: true };
        store.saveDraft(mode, draft);
        track('explain_open');
      }
      draw();
      if (showExplain) el.querySelector('.explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // 좌우로 밀어서 이전·다음 문제 (세로 스크롤과 헷갈리지 않게 가로가 확실할 때만)
  let touch = null;
  el.addEventListener('touchstart', e => {
    touch = e.touches.length === 1 && !e.target.closest('.passage') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx < 0 && draft.current < total - 1) go(draft.current + 1);
    else if (dx > 0 && draft.current > 0) go(draft.current - 1);
  });

  draw();
  if (!exam) return () => document.body.classList.remove('focus-mode');

  const timer = setInterval(() => {
    const left = remainingSec(draft);
    const t = el.querySelector('#timer');
    if (t) {
      t.textContent = `⏱ ${clock(left)}`;
      t.classList.toggle('is-low', left <= LOW_TIME_SEC);
    }
    if (left === 0) {
      clearInterval(timer);
      closeModal();
      finish(draft);
    }
  }, 1000);

  return () => {
    clearInterval(timer);
    document.body.classList.remove('focus-mode');
  };
}

function renderResult(el, id) {
  const r = store.getState().exams.find(x => x.id === id);
  if (!r) {
    el.innerHTML = `<header class="page-head"><h1>채점 결과</h1></header><div class="card empty"><p>결과를 찾을 수 없어요.</p><a class="btn btn-primary" href="#/">홈으로</a></div>`;
    return;
  }
  const isExam = r.mode !== 'study';
  const questions = r.ids.map(qid => data.getQuestion(qid)).filter(Boolean);
  const viewed = r.viewed ?? {};
  const scored = r.scored ?? r.total;
  const wrongIds = questions.filter(q => r.answers[q.id] !== q.answer).map(q => q.id);
  const rate = scored ? Math.round((r.correct / scored) * 100) : 0;
  const byEra = data.ERAS
    .map(era => {
      const list = questions.filter(q => q.era === era && !viewed[q.id]);
      return { era, total: list.length, ok: list.filter(q => r.answers[q.id] === q.answer).length };
    })
    .filter(x => x.total);
  const open = new Set();
  const failed = r.grade === '불합격';
  const counts = [
    ['정답', r.correct],
    ['오답', r.wrong ?? questions.filter(q => r.answers[q.id] != null && r.answers[q.id] !== q.answer).length],
    ['미응답', r.blank ?? questions.filter(q => r.answers[q.id] == null).length],
    ['해설 본 문제', r.viewedCount ?? 0],
  ];
  // 기념일 퀴즈 뒤 '더 풀어보기': 같은 시대 문제로 이어서
  const moreEra = r.kind === 'anniv' ? questions[0]?.era : null;

  function rowHTML(q, i) {
    const mine = r.answers[q.id] ?? null;
    const ok = mine === q.answer;
    const isOpen = open.has(q.id);
    return `<li>
      <button type="button" class="list-row link-row" data-toggle="${esc(q.id)}" aria-expanded="${isOpen}">
        <span class="qno">${i + 1}</span>
        <span class="mark ${ok ? 'is-ok' : 'is-bad'}" aria-label="${ok ? '정답' : '오답'}">${ok ? '○' : '✕'}</span>
        <span class="grow clamp">${esc(q.question)}${viewed[q.id] ? ' <span class="due-today small">(해설 봄)</span>' : ''}</span>
        <span class="muted small">${mine ? CIRCLED[mine - 1] : '안 풂'} / ${CIRCLED[q.answer - 1]}</span>
      </button>
      ${isOpen ? `<div class="result-detail">${questionHTML(q, { selected: mine, revealed: true, hideHead: true })}</div>` : ''}
    </li>`;
  }

  function draw() {
    el.innerHTML = `
      <header class="page-head"><div><a class="back" href="${isExam ? '#/exam' : '#/'}">← ${isExam ? '모의고사' : '홈'}</a><h1>${esc(r.title ?? '시험 결과')}</h1></div></header>
      <section class="card summary">
        ${isExam
          ? `<p class="score-big">${r.score}<span class="score-of">점</span></p>
             <p><span class="grade ${failed ? 'is-fail' : ''}">${failed ? '불합격' : `심화 ${r.grade}`}</span></p>`
          : `<p class="score-big">${r.correct}<span class="score-of"> / ${scored}</span></p>`}
        <p class="muted small">정답률 ${rate}%${isExam ? ` · ${duration(r.sec)}` : ''}</p>
        <div class="result-stats">${counts.map(([label, n]) => `<div><b>${n}</b><span>${label}</span></div>`).join('')}</div>
        ${r.viewedCount ? '<p class="muted small">해설을 보고 푼 문제는 점수와 정답률에서 뺐어요.</p>' : ''}
        ${wrongIds.length ? '<p class="small">틀린 문제는 오답노트에 넣었어요.</p>' : ''}
      </section>
      ${isExam && byEra.length ? `<h2 class="section-title">시대별 결과</h2>
      <section class="card">${byEra.map(x => barRowHTML(x.era, x.ok / x.total, `${x.ok}/${x.total}`, { tip: `${x.era}: ${x.total}문항 중 ${x.ok}개 정답` })).join('')}</section>` : ''}
      <h2 class="section-title">문항별 결과 <span class="muted">(내 답 / 정답) · 눌러서 해설 보기</span></h2>
      <section class="card"><ul class="list">${questions.map(rowHTML).join('')}</ul></section>
      <div class="stack">
        ${wrongIds.length ? `<button type="button" class="btn btn-primary btn-block" data-act="retry">틀리거나 안 푼 문제 다시 풀기 (${wrongIds.length})</button>` : ''}
        ${moreEra ? `<a class="btn btn-ghost btn-block" href="#/quiz?mode=more&era=${encodeURIComponent(moreEra)}">더 풀어보기</a>` : ''}
        ${isExam ? '<a class="btn btn-ghost btn-block" href="#/exam">다시 응시하기</a>' : '<a class="btn btn-ghost btn-block" href="#/quiz?mode=more">문제 더 풀기</a>'}
        <a class="btn btn-ghost btn-block" href="#/">홈으로</a>
      </div>`;
  }

  el.addEventListener('click', e => {
    if (e.target.closest('[data-act="retry"]')) {
      startSession('study', { title: '틀린 문제 다시 풀기', ids: wrongIds, kind: 'retry', key: `retry:${r.id}` });
      return;
    }
    const toggle = e.target.closest('[data-toggle]');
    if (!toggle) return;
    const qid = toggle.dataset.toggle;
    if (open.has(qid)) open.delete(qid);
    else open.add(qid);
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  });

  draw();
}
