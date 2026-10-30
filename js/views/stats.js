// 내 분석: 전체 요약, 시대별 정답률(약점), 최근 7일 학습량, 모의고사 기록
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, addDays, weekday, formatShort, toDateStr } from '../dates.js';
import { esc, barRowHTML } from '../ui.js';

// 이만큼은 풀어야 약점으로 판단해요.
const MIN_ATTEMPTS = 3;
// 최근 7일 막대의 최대 높이(px)
const WEEK_BAR_MAX = 110;

export function render(el) {
  const today = todayStr();
  const { attempts } = store.getState();
  // 해설을 보고 푼 기록은 정답률에서 빼요. 모의고사 기록은 시험 모드만 보여요.
  const valid = attempts.filter(a => !a.viewed && data.getQuestion(a.q));
  const exams = store.getState().exams.filter(r => r.mode !== 'study');

  if (!valid.length) {
    el.innerHTML = `
      <header class="page-head"><h1>내 분석</h1></header>
      <div class="card empty"><p>아직 푼 문제가 없어요.<br>오늘의 문제부터 풀어 볼까요?</p><a class="btn btn-primary" href="#/">오늘의 문제 풀기</a></div>`;
    return;
  }

  const correct = valid.filter(a => a.ok).length;
  const best = exams.length ? Math.max(...exams.map(e => e.score)) : null;
  const s = store.streak(today);

  const byEra = data.ERAS.map(era => {
    const list = valid.filter(a => data.getQuestion(a.q).era === era);
    const ok = list.filter(a => a.ok).length;
    return { era, n: list.length, ok, rate: list.length ? ok / list.length : 0 };
  });
  // 정답률이 같으면 더 많이 푼(그래서 더 확실한) 시대를 약점으로 봐요.
  const ranked = byEra.filter(x => x.n >= MIN_ATTEMPTS).sort((a, b) => a.rate - b.rate || b.n - a.n);
  const weakest = ranked.length >= 2 && ranked[0].rate < 1 ? ranked[0] : null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const counts = days.map(d => valid.filter(a => a.day === d).length);
  const maxCount = Math.max(1, ...counts);
  const weekTotal = counts.reduce((sum, n) => sum + n, 0);

  el.innerHTML = `
    <header class="page-head"><h1>내 분석</h1></header>
    <div class="tiles">
      <div class="card tile"><p class="tile-label">푼 문제</p><p class="tile-value">${valid.length}</p><p class="tile-sub">누적 풀이 수</p></div>
      <div class="card tile"><p class="tile-label">정답률</p><p class="tile-value">${Math.round((correct / valid.length) * 100)}%</p><p class="tile-sub">${correct}개 정답</p></div>
      <div class="card tile"><p class="tile-label">연속 학습</p><p class="tile-value">🔥 ${s.count}일</p><p class="tile-sub">${s.doneToday ? '오늘 공부 완료' : '오늘은 아직이에요'}</p></div>
      <div class="card tile"><p class="tile-label">모의고사 최고</p><p class="tile-value">${best ?? '—'}${best != null ? '<span class="score-of">점</span>' : ''}</p><p class="tile-sub">${exams.length}회 응시</p></div>
    </div>

    ${weakest ? `<section class="card card-anniv">
      <p class="eyebrow">약점 시대</p>
      <h2>${esc(weakest.era)} 정답률이 가장 낮아요 (${Math.round(weakest.rate * 100)}%)</h2>
      <p>${esc(weakest.era)} 문제를 집중해서 풀어 보세요.</p>
      <a class="btn btn-primary btn-block" href="#/quiz?mode=era&era=${encodeURIComponent(weakest.era)}">${esc(weakest.era)} 문제 풀기</a>
    </section>` : ''}

    <h2 class="section-title">시대별 정답률</h2>
    <section class="card">
      ${byEra.map(x => barRowHTML(x.era, x.rate, x.n ? `${Math.round(x.rate * 100)}% · ${x.n}회` : '기록 없음', {
        weak: weakest?.era === x.era,
        tip: x.n ? `${x.era}: ${x.n}번 풀어서 ${x.ok}번 정답` : `${x.era}: 아직 안 풀었어요`,
      })).join('')}
      <p class="muted small mt">${MIN_ATTEMPTS}번 이상 푼 시대끼리 비교해서 약점을 찾아요.</p>
    </section>

    <h2 class="section-title">최근 7일 <span class="muted">· ${weekTotal}문제</span></h2>
    <section class="card">
      <div class="week" role="img" aria-label="최근 7일 동안 푼 문제 수: ${days.map((d, i) => `${formatShort(d)} ${counts[i]}개`).join(', ')}">
        ${days.map((d, i) => `<div class="week-col" title="${formatShort(d)}: ${counts[i]}문제">
          ${d === today ? `<span class="week-count">${counts[i]}</span>` : ''}
          <span class="week-bar" style="height:${Math.round((counts[i] / maxCount) * WEEK_BAR_MAX)}px"></span>
        </div>`).join('')}
      </div>
      <div class="week-labels">${days.map(d => `<span class="${d === today ? 'is-today' : ''}">${d === today ? '오늘' : weekday(d)}</span>`).join('')}</div>
    </section>

    ${exams.length ? `<h2 class="section-title">모의고사 기록</h2>
    <section class="card"><ul class="list">
      ${[...exams].reverse().slice(0, 5).map(r => `<li><a class="list-row link-row" href="#/exam/result/${r.id}">
        <div class="grow"><b>${r.score}점</b><span class="grade-chip ${r.grade === '불합격' ? 'is-fail' : ''}">${r.grade}</span></div>
        <span class="muted small">${formatShort(toDateStr(new Date(r.at)))}</span>
      </a></li>`).join('')}
    </ul></section>` : ''}`;
}
