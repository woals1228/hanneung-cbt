// 81회 빈출 예측: 57~80회 심화 24번을 분석한 주제별 출제 횟수(data/frequency.json)
import * as data from '../data.js';
import { todayStr } from '../dates.js';
import { esc } from '../ui.js';

const rowHTML = (f, open) => {
  const n = f.ids.filter(id => open.has(id)).length;
  const trend = f.trend === 'up' ? '<span class="trend up">⬆</span> ' : f.trend === 'down' ? '<span class="trend down">⬇</span> ' : '';
  const inner = `<div class="grow"><b>${trend}${esc(f.topic)}</b>
      <p class="muted small">${esc(f.era)} · 24회 중 ${f.all}회 · 최근 8회 중 ${f.recent}회</p></div>
    ${n ? `<span class="btn btn-ghost btn-sm">${n}문제 풀기</span>` : ''}`;
  return n
    ? `<li><a class="list-row link-row" href="#/quiz?mode=topic&t=${encodeURIComponent(f.topic)}">${inner}</a></li>`
    : `<li><div class="list-row">${inner}</div></li>`;
};

export function render(el) {
  const open = new Set(data.examPool(todayStr()).map(q => q.id));
  const all = data.frequency();
  const up = all.filter(f => f.trend === 'up');
  const down = all.filter(f => f.trend === 'down');
  const staple = all.filter(f => f.all >= 20 && f.trend !== 'up').sort((a, b) => b.all - a.all || b.recent - a.recent);
  const section = (title, sub, list) => list.length ? `<h2 class="section-title">${title} <span class="muted">· ${sub}</span></h2>
    <section class="card"><ul class="list">${list.map(f => rowHTML(f, open)).join('')}</ul></section>` : '';

  el.innerHTML = `
    <header class="page-head"><div><a class="back" href="#/">← 홈</a><h1>81회 빈출 예측</h1></div></header>
    <section class="card">
      <p>57~80회 심화 문제지 24개를 분석해서, 주제마다 몇 번 나왔는지 셌어요.</p>
      <a class="btn btn-primary btn-block mt" href="#/quiz?mode=hot">🎯 빈출 예상 10문제 풀기</a>
      <p class="muted small mt">오답 보기에 나온 것도 셌고, 최근 8회는 표본이 작아서 흐름 표시는 참고만 하세요. 출제를 보장하지 않아요.</p>
    </section>
    ${section('⬆ 최근 늘어난 주제', `${up.length}개`, up)}
    ${section('매회 나오는 주제', '24회 중 20회 이상', staple)}
    ${section('⬇ 예전보다 줄어든 주제', '다시 나올 수도 있어요', down)}`;
}
