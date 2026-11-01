// 81회 가채점: 내 답 50개를 넣어 두면 공식 정답(data/answers-81.json)이 나오는 즉시 점수와 예상 급수를 보여 줘요.
import { todayStr, daysBetween, dday, formatShort } from '../dates.js';
import { esc, CIRCLED, toast, confirmModal } from '../ui.js';
import { shareHongpae } from '../gwageo.js';

export const GRADE = { round: 81, from: '2026-11-28', until: '2026-12-12' };
const COUNT = 50;
const KEY = `hcbt.grade${GRADE.round}`;
const GRADES = [[80, '심화 1급'], [70, '심화 2급'], [60, '심화 3급']];

function loadPicks() {
  try { return JSON.parse(localStorage.getItem(KEY))?.picks ?? {}; } catch { return {}; }
}

function savePicks(picks) {
  try { localStorage.setItem(KEY, JSON.stringify({ picks, at: Date.now() })); } catch { /* 이번만 적용돼요 */ }
}

export function render(el) {
  const today = todayStr();
  let picks = loadPicks();
  let key = null;

  function resultHTML() {
    const filled = Object.keys(picks).length;
    if (!key?.released) {
      const days = daysBetween(today, GRADE.from);
      return `<section class="card grade-wait">
        <p><b>${days > 0 ? `시험까지 ${dday(days)}` : '정답 발표를 기다리고 있어요'}</b></p>
        <p class="muted small">국사편찬위원회가 정답을 발표하면 바로 넣어요. 그 전에 기억나는 내 답을 넣어 두면, 다시 열었을 때 점수가 바로 보여요.</p>
      </section>`;
    }
    const scored = Array.from({ length: COUNT }, (_, i) => i + 1).filter(n => picks[n]);
    const ok = scored.filter(n => picks[n] === key.answers[n - 1]);
    const score = ok.reduce((s, n) => s + (key.points[n - 1] ?? 2), 0);
    const grade = GRADES.find(([min]) => score >= min)?.[1] ?? '불합격';
    const wrong = scored.filter(n => picks[n] !== key.answers[n - 1]);
    return `<section class="card summary">
      <p class="muted small">제${GRADE.round}회 가채점 · ${filled}/${COUNT}문항 입력</p>
      <p class="score-big">${score}<span class="score-of">점</span></p>
      <p><span class="grade ${grade === '불합격' ? 'is-fail' : ''}">${grade}</span></p>
      <p class="muted small">${ok.length}문항 정답${filled < COUNT ? ` · 안 넣은 ${COUNT - filled}문항은 0점으로 셌어요` : ''}</p>
      ${wrong.length ? `<p class="small mt">틀린 문항: ${wrong.map(n => `${n}번(정답 ${CIRCLED[key.answers[n - 1] - 1]})`).join(', ')}</p>` : ''}
      <button type="button" class="btn btn-primary btn-block mt" data-act="share" data-score="${score}" data-ok="${ok.length}">🖼 결과 이미지 저장·공유</button>
      ${key.source ? `<p class="muted small mt">정답 출처: <a href="${esc(key.source)}" target="_blank" rel="noopener">국사편찬위원회</a> · 가채점은 참고용이에요.</p>` : ''}
    </section>`;
  }

  function sheetHTML() {
    const rows = Array.from({ length: COUNT }, (_, i) => {
      const n = i + 1;
      const right = key?.released ? key.answers[i] : null;
      return `<li class="sheet-row"><span class="sheet-no">${n}</span>${[1, 2, 3, 4, 5].map(c => {
        const cls = [picks[n] === c ? 'is-on' : '', right === c ? 'is-right' : '', right && picks[n] === c && c !== right ? 'is-wrong' : ''].join(' ').trim();
        return `<button type="button" class="${cls}" data-n="${n}" data-c="${c}" aria-pressed="${picks[n] === c}" aria-label="${n}번 ${c}">${CIRCLED[c - 1]}</button>`;
      }).join('')}</li>`;
    }).join('');
    return `<section class="card">
      <div class="card-title"><span>내 답 <span class="muted">${Object.keys(picks).length}/${COUNT}</span></span>
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear">모두 지우기</button></div>
      <div class="row mb">
        <input type="text" inputmode="numeric" id="paste" class="grow" placeholder="숫자 50개 한 줄로 붙여 넣기 (예: 13524…)" aria-label="내 답 한 줄로 넣기">
        <button type="button" class="btn btn-primary btn-sm" data-act="paste">넣기</button>
      </div>
      <ol class="sheet">${rows}</ol>
    </section>`;
  }

  function draw() {
    el.innerHTML = `
      <header class="page-head"><div><a class="back" href="#/">← 홈</a><h1>제${GRADE.round}회 가채점</h1></div>
        <span class="muted small">${formatShort(GRADE.from)} 시험</span></header>
      ${resultHTML()}
      ${sheetHTML()}`;
  }

  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-n]');
    const act = e.target.closest('[data-act]');
    if (btn) {
      const n = Number(btn.dataset.n);
      const c = Number(btn.dataset.c);
      if (picks[n] === c) delete picks[n];
      else picks[n] = c;
      savePicks(picks);
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    } else if (act?.dataset.act === 'paste') {
      // 1~5만 골라 앞에서부터 채워요(빈칸·쉼표 등은 무시, 0은 안 푼 문항).
      const digits = el.querySelector('#paste').value.replace(/[^0-5]/g, '').slice(0, COUNT);
      if (!digits.length) {
        toast('1~5 숫자를 넣어 주세요');
        return;
      }
      picks = {};
      [...digits].forEach((d, i) => { if (d !== '0') picks[i + 1] = Number(d); });
      savePicks(picks);
      draw();
      toast(`${digits.length}문항을 넣었어요`);
    } else if (act?.dataset.act === 'clear' && await confirmModal({ title: '내 답을 모두 지울까요?', ok: '지우기', danger: true })) {
      picks = {};
      savePicks(picks);
      draw();
    } else if (act?.dataset.act === 'share') {
      const score = Number(act.dataset.score);
      const r = { correct: Number(act.dataset.ok), scored: COUNT, total: COUNT, at: Date.now(), ids: [] };
      const how = await shareHongpae(r, score, { text: `한능검 ${GRADE.round}회 가채점 ${score}점! 너도 채점해 봐 → ${location.origin + location.pathname}#/grade` });
      if (how === 'saved') toast('결과 이미지를 저장했어요');
    }
  });

  draw();
  // 정답 발표 당일에 예전 파일이 보이지 않게 매번 서버에 확인해요.
  fetch(`data/answers-${GRADE.round}.json`, { cache: 'no-cache' })
    .then(res => (res.ok ? res.json() : null))
    .then(json => {
      key = json?.released && json.answers?.length === COUNT ? json : null;
      draw();
    })
    .catch(() => {});
}
