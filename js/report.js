// 나의 한국사 명식표: 시대마다 배점을 반영한 정답률 → 목표 합격선 기준 강·보통·약, 놓치는 점수 순 풀이 (박사 기준 11/1)
import * as data from './data.js';
import * as store from './store.js';
import { esc } from './ui.js';

// 심화 합격선: 1급 80점, 2급 70점, 3급 60점
export const CUTS = { 1: 80, 2: 70, 3: 60 };
const GOAL_KEY = 'hcbt.goal';

export function getGoal() {
  try { return Number(localStorage.getItem(GOAL_KEY)) || null; } catch { return null; }
}

export function setGoal(goal) {
  try { localStorage.setItem(GOAL_KEY, String(goal)); } catch { /* 이번만 적용돼요 */ }
}

// 57~80회 심화 평균, 시대마다 시험에 나오는 점수
export const ERA_POINTS = { 선사: 1, 고대: 18.5, 고려: 14.8, 조선: 20.6, 근대: 14.3, '일제 강점기': 15.2, 현대: 14.3 };
const SHORT = { '일제 강점기': '일제' };
const RECENT = 30;
const minCount = era => (era === '선사' ? 5 : 10);

const TIPS = {
  선사: '토기·도구로 시대를 가려요. 빗살무늬 = 신석기, 고인돌·비파형 동검 = 청동기, 세형 동검·명도전 = 철기예요.',
  고대: '왕 업적 구별이 핵심이에요. 법흥왕(율령·불교 공인)↔진흥왕(한강·순수비), 문무왕↔신문왕(관료전)부터 보세요.',
  고려: '고려 경제·성종·무신 정권이 거의 매회 나와요. 광종↔성종, 최충헌(교정도감)↔최우(정방)를 가르세요.',
  조선: '세도 정치·농민 봉기와 영조↔정조, 대동법↔균역법, 4대 사화 순서가 단골이에요.',
  근대: '순서 문제가 많아요. 병인양요(1866) → 신미양요(1871) → 강화도 조약 → 임오군란 → 갑신정변 → 동학 농민 운동이에요.',
  '일제 강점기': '1910년대(헌병 경찰·회사령) → 1920년대(문화 통치·산미 증식) → 1930~40년대(황국 신민·창씨개명)로 시기마다 구별하세요.',
  현대: '정부와 통일 정책의 짝이에요. 7·4는 박정희, 남북 기본 합의서는 노태우, 6·15는 김대중, 10·4는 노무현이에요.',
};

export function eraReport(goal = getGoal()) {
  const cut = CUTS[goal] ?? CUTS[2];
  const valid = store.getState().attempts.filter(a => !a.viewed && data.getQuestion(a.q));
  const points = a => data.getQuestion(a.q).points ?? 2;
  return data.ERAS.map(era => {
    const list = valid.filter(a => data.getQuestion(a.q).era === era).slice(-RECENT);
    const all = list.reduce((s, a) => s + points(a), 0);
    const got = list.filter(a => a.ok).reduce((s, a) => s + points(a), 0);
    const enough = list.length >= minCount(era);
    const rate = all ? Math.round((got / all) * 100) : null;
    let level = null;
    if (enough) level = rate < cut ? '약' : rate < cut + 10 ? '보통' : '강';
    const wrong = new Map();
    for (const a of list.filter(x => !x.ok)) {
      const q = data.getQuestion(a.q);
      const topic = q.freq?.topic ?? q.topic;
      wrong.set(topic, (wrong.get(topic) ?? 0) + 1);
    }
    return {
      era,
      n: list.length,
      need: Math.max(0, minCount(era) - list.length),
      rate,
      level,
      // 시험에서 이 시대 배점 중 놓치는 점수
      lose: enough ? Math.round((1 - rate / 100) * ERA_POINTS[era] * 10) / 10 : null,
      topWrong: [...wrong].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
    };
  });
}

export function myeongsikHTML(report, goal = getGoal()) {
  const cut = CUTS[goal] ?? CUTS[2];
  const cells = report.map(r => `<div class="ms-cell ms-${data.eraIndex(r.era)}">
      <span class="ms-era">${esc(SHORT[r.era] ?? r.era)}</span>
      <span class="ms-level ${r.level === '약' ? 'is-weak' : r.level === '강' ? 'is-strong' : ''}">${r.level ?? '?'}</span>
      <span class="ms-rate">${r.level ? `${r.rate}%` : `${r.need}문제 더`}</span>
    </div>`).join('');
  const known = report.filter(r => r.level).sort((a, b) => b.lose - a.lose);
  const rows = known.map((r, i) => `<details class="ms-detail" ${i === 0 ? 'open' : ''}>
      <summary><b>${esc(r.era)} ${r.level}</b><span class="muted small">놓치는 점수 약 ${r.lose}점</span></summary>
      <p>정답률 ${r.rate}%(최근 ${r.n}문제) · 시험에서 약 ${ERA_POINTS[r.era]}점 중 ${r.lose}점을 놓치고 있어요.${r.topWrong ? ` 가장 많이 틀린 주제: <b>${esc(r.topWrong)}</b>.` : ''}</p>
      <p class="muted small">${TIPS[r.era]}</p>
      <a class="btn btn-ghost btn-sm mt" href="#/quiz?mode=era&era=${encodeURIComponent(r.era)}">${esc(r.era)} 문제 풀기</a>
    </details>`).join('');
  return `<section class="card myeongsik">
    <div class="card-title"><span>나의 한국사 명식</span><span class="muted small">목표 ${goal ?? 2}급 · 합격선 ${cut}점 기준</span></div>
    <div class="ms-grid">${cells}</div>
    <p class="muted small mt">시대마다 최근 30문제, 배점을 반영한 정답률이에요. 합격선 아래면 약, +10점 이상이면 강이에요.</p>
    ${rows ? `<h3 class="ms-title">놓치는 점수가 큰 순서</h3>${rows}` : '<p class="mt small">시대마다 10문제(선사 5문제)를 풀면 강·약을 알려 드려요. 실전 모의고사 1회면 거의 다 채워져요.</p>'}
  </section>`;
}
