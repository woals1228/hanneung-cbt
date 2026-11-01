// 합격 플랜: 시작일부터 시험 전날까지 날짜별 계획 (박사 11/1 안)
//  진단 1일 → 시대별 1회독(시대 배점 비율로 날 수, 빈출 주제 순) → 약점 2회독 5일(1·3·5일째 모의고사) → 정리 → 전야제
//  저장은 입력값만 하고, 계획표는 그때그때 다시 만들어요(탈모 권고).
import * as data from './data.js';
import * as store from './store.js';
import { addDays, daysBetween } from './dates.js';
import { ERA_POINTS, eraReport } from './report.js';

const KEY = 'hcbt.plan';
// 하루 공부 시간 → 하루에 볼 빈출 주제 수 (주제마다 5문제쯤)
export const MINUTES = { 30: 3, 60: 6, 120: 8 };
// 선사는 1점뿐이라 고대와 묶어요.
const GROUPS = [['선사', '고대'], ['고려'], ['조선'], ['근대'], ['일제 강점기'], ['현대']];

export function getPlan() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}

export function savePlan(plan) {
  try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch { /* 이번만 적용돼요 */ }
}

export function clearPlan() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

// 날 수를 시대 배점 비율로 나눠요(큰 나머지부터 하루씩 더).
function splitDays(total) {
  const weights = GROUPS.map(g => g.reduce((s, era) => s + ERA_POINTS[era], 0));
  const sum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map(w => (w / sum) * total);
  const days = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - days[i], i]).sort((a, b) => b[0] - a[0]);
  const left = total - days.reduce((s, d) => s + d, 0);
  for (let k = 0; k < left; k++) days[order[k][1]] += 1;
  return days;
}

// 시대 묶음의 빈출 주제를 많이 나온 순서로, 묶음의 날마다 나눠요.
function topicsFor(group, dayCount, perDay, minutes) {
  let list = data.frequency()
    .filter(f => group.includes(f.era) && (f.ids.length || f.pastIds?.length))
    .sort((a, b) => b.all - a.all || b.recent - a.recent);
  if (minutes < 60) list = list.filter(f => f.all >= 15);
  list = list.slice(0, perDay * dayCount);
  return Array.from({ length: dayCount }, (_, i) => list.slice(Math.round((i * list.length) / dayCount), Math.round(((i + 1) * list.length) / dayCount)));
}

export function buildPlan(plan, exam) {
  if (!plan || !exam) return [];
  const last = addDays(exam.date, -1);
  const total = daysBetween(plan.start, exam.date);
  if (total < 1) return [];
  const perDay = MINUTES[plan.minutes] ?? MINUTES[60];
  const days = [];
  const push = item => days.push({ date: addDays(plan.start, days.length), ...item });

  const tail = total >= 3 ? 2 : total - 1;
  const rest = Math.max(0, total - 1 - tail);
  const weakDays = rest >= 10 ? 5 : Math.floor(rest / 3);
  const eraDays = rest - weakDays;

  if (total === 1) return [{ date: plan.start, kind: 'eve', title: '전야제: 새 주제는 보지 않기' }];
  push({ kind: 'diag', title: '진단: 실전 모의고사로 명식표 만들기' });
  if (eraDays >= GROUPS.length) {
    splitDays(eraDays).forEach((count, g) => {
      const name = GROUPS[g].join('·');
      topicsFor(GROUPS[g], count, perDay, plan.minutes).forEach((topics, i) => {
        push({ kind: 'era', title: `${name} 1회독${count > 1 ? ` (${i + 1}/${count})` : ''}`, topics });
      });
    });
  } else {
    // 남은 날이 시대 묶음보다 적으면 하루에 여러 시대를 빈출 위주로 몰아서 봐요.
    for (let i = 0; i < eraDays; i++) {
      const groups = GROUPS.slice(Math.round((i * GROUPS.length) / eraDays), Math.round(((i + 1) * GROUPS.length) / eraDays));
      const eras = groups.flat();
      push({ kind: 'era', title: `${eras.join('·')} 빠른 1회독`, topics: topicsFor(eras, 1, perDay, plan.minutes)[0] });
    }
  }
  for (let i = 0; i < weakDays; i++) push({ kind: 'weak', title: `약점 2회독 ${i + 1}일째`, mock: i % 2 === 0 });
  if (tail >= 2) push({ kind: 'review', title: '정리: 헷갈리는 짝·빈출 TOP' });
  if (tail >= 1 && days.length < total) push({ kind: 'eve', title: '전야제: 새 주제는 보지 않기' });
  return days.filter(d => d.date <= last);
}

export const planDay = (days, date) => days.find(d => d.date === date) ?? null;

// 그날 할 일 링크. 주제는 그날 그 주제 문제를 하나라도 풀면 끝낸 것으로 봐요.
export function dayLinks(day) {
  const solved = new Set(store.getState().attempts.filter(a => a.day === day.date).map(a => a.q));
  switch (day.kind) {
    case 'diag':
      return [
        { title: '실전 모의고사 50문항', sub: '80분 · 명식표가 바로 채워져요', href: '#/exam' },
        { title: '시간이 없으면 10문항 진단', sub: '약 5분', href: '#/quiz?mode=test' },
      ];
    case 'era':
      return day.topics.map(f => ({
        title: f.topic,
        sub: `24회 중 ${f.all}회 출제`,
        href: `#/quiz?mode=topic&t=${encodeURIComponent(f.topic)}`,
        done: [...f.ids, ...(f.pastIds ?? [])].some(id => solved.has(id)),
      }));
    case 'weak': {
      const weakest = eraReport().filter(r => r.level).sort((a, b) => b.lose - a.lose)[0];
      return [
        weakest
          ? { title: `${weakest.era} 다시 보기`, sub: `놓치는 점수 약 ${weakest.lose}점`, href: `#/quiz?mode=era&era=${encodeURIComponent(weakest.era)}` }
          : { title: '명식표에서 약한 시대 찾기', sub: '마이 화면', href: '#/stats' },
        { title: '오답노트 복습', sub: '틀린 문제 다시', href: '#/quiz?mode=wrong' },
        ...(day.mock ? [{ title: '기출 모의고사 1회', sub: '50문항 · 80분', href: '#/exam' }] : []),
      ];
    }
    case 'review':
      return [{ title: '81회 빈출 예측 훑어보기', sub: '많이 나온 주제와 최근 늘어난 주제', href: '#/hot' }];
    case 'eve':
      return [{ title: '전야제 문제 풀기', sub: '빈출 주제로 새로 만든 문제', href: '#/quiz?mode=eve' }];
    default:
      return [];
  }
}
