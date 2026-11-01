// 합격 플랜: 하루 공부 시간을 고르면 시험 전날까지 날짜별 계획표 (공부한 날은 ✓)
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, daysBetween, formatShort, dday } from '../dates.js';
import { esc, confirmModal } from '../ui.js';
import { getPlan, savePlan, clearPlan, buildPlan, planDay, dayLinks, MINUTES } from '../plan.js';
import { CUTS, getGoal, setGoal } from '../report.js';

const MINUTE_LABEL = { 30: '30분', 60: '1시간', 120: '2시간' };

export function linksHTML(links) {
  return `<ul class="list">${links.map(l => `<li><a class="todo ${l.done ? 'is-done' : ''}" href="${l.href}">
    <span class="todo-check" aria-hidden="true">${l.done ? '✓' : ''}</span>
    <span class="grow"><b>${esc(l.title)}</b><small>${esc(l.sub)}</small></span><span class="muted" aria-hidden="true">›</span></a></li>`).join('')}</ul>`;
}

export function render(el) {
  const today = todayStr();
  const exam = data.nextExam(today);
  let minutes = 60;

  function setupHTML() {
    const goal = getGoal();
    return `<section class="card">
      <p class="muted small">${exam ? `제${exam.round}회 ${esc(exam.level)} · ${formatShort(exam.date)} · ${dday(daysBetween(today, exam.date))}` : '다음 시험 일정이 아직 없어요'}</p>
      <h2 class="plan-q">목표 급수</h2>
      <div class="seg" role="group" aria-label="목표 급수">${[1, 2, 3].map(g => `<button type="button" data-goal="${g}" aria-pressed="${g === goal}" class="${g === goal ? 'is-on' : ''}">${g}급 · ${CUTS[g]}점</button>`).join('')}</div>
      <h2 class="plan-q">하루 공부 시간</h2>
      <div class="seg" role="group" aria-label="하루 공부 시간">${Object.keys(MINUTES).map(m => `<button type="button" data-min="${m}" aria-pressed="${Number(m) === minutes}" class="${Number(m) === minutes ? 'is-on' : ''}">${MINUTE_LABEL[m]}</button>`).join('')}</div>
      <p class="muted small mt">진단 → 시대별 1회독(빈출 주제 순) → 약점 2회독과 모의고사 → 정리 → 전야제 순서로 짜요.</p>
      <button type="button" class="btn btn-primary btn-block mt" data-act="make" ${exam ? '' : 'disabled'}>합격 플랜 만들기</button>
    </section>`;
  }

  function planHTML(plan) {
    const days = buildPlan(plan, exam);
    const studied = new Set(store.getState().attempts.map(a => a.day));
    const todayItem = planDay(days, today);
    const doneCount = days.filter(d => d.date < today && studied.has(d.date)).length;
    const past = days.filter(d => d.date < today).length;
    return `
      ${todayItem ? `<section class="card plan-today">
        <div class="card-title"><span>오늘 · ${esc(todayItem.title)}</span><span class="muted small">${days.indexOf(todayItem) + 1}/${days.length}일째</span></div>
        ${linksHTML(dayLinks(todayItem))}
      </section>` : ''}
      <h2 class="section-title">전체 계획 <span class="muted">· 지난 ${past}일 중 ${doneCount}일 공부 · 하루 ${MINUTE_LABEL[plan.minutes]}</span></h2>
      <section class="card"><ol class="plan-list">
        ${days.map(d => `<li class="${d.date === today ? 'is-today' : d.date < today ? 'is-past' : ''}">
          <span class="plan-date">${formatShort(d.date)}</span>
          <span class="grow">${esc(d.title)}${d.kind === 'era' && d.topics.length ? `<small>${d.topics.map(f => esc(f.topic)).join(' · ')}</small>` : ''}</span>
          <span class="plan-mark" aria-label="${studied.has(d.date) ? '공부함' : ''}">${studied.has(d.date) ? '✓' : ''}</span>
        </li>`).join('')}
      </ol></section>
      <button type="button" class="btn btn-ghost btn-block" data-act="reset">플랜 다시 만들기</button>`;
  }

  function draw() {
    const plan = getPlan();
    const active = plan && exam && plan.exam === exam.round;
    el.innerHTML = `
      <header class="page-head"><div><a class="back" href="#/">← 홈</a><h1>합격 플랜</h1></div></header>
      ${active ? planHTML(plan) : setupHTML()}`;
  }

  el.addEventListener('click', async e => {
    const goal = e.target.closest('[data-goal]');
    const min = e.target.closest('[data-min]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (goal) {
      setGoal(goal.dataset.goal);
      draw();
    } else if (min) {
      minutes = Number(min.dataset.min);
      draw();
    } else if (act === 'make' && exam) {
      if (!getGoal()) setGoal(2);
      savePlan({ start: today, minutes, exam: exam.round });
      draw();
      window.scrollTo(0, 0);
    } else if (act === 'reset' && await confirmModal({ title: '플랜을 다시 만들까요?', message: '공부 기록은 그대로 남아요.', ok: '다시 만들기' })) {
      minutes = getPlan()?.minutes ?? 60;
      clearPlan();
      draw();
    }
  });

  draw();
}
