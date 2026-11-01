// 과거 시험장: 10문항 진단, 급제 칭호, 홍패(조선의 과거 합격증) 이미지와 도전장 공유
import * as data from './data.js';
import { esc, shuffle } from './ui.js';

export const TEST_SIZE = 10;
// 시대마다 몇 문항씩 (합 10). 문제가 모자란 시대는 다른 시대 문제로 채워요.
const PLAN = { 선사: 1, 고대: 2, 고려: 2, 조선: 2, 근대: 1, '일제 강점기': 1, 현대: 1 };

// 친구가 보낸 도전장(ids)이 있으면 그 문제로, 없으면 새로 골라요. 아직 열리지 않은 문제는 빼요.
export function testSet(today, givenIds = []) {
  const pool = data.examPool(today);
  const open = new Set(pool.map(q => q.id));
  const given = givenIds.filter(id => open.has(id)).slice(0, TEST_SIZE);
  if (given.length >= 5) return given;
  const mixed = shuffle(pool);
  const picked = [];
  for (const [era, n] of Object.entries(PLAN)) picked.push(...mixed.filter(q => q.era === era).slice(0, n));
  picked.push(...mixed.filter(q => !picked.includes(q)).slice(0, TEST_SIZE - picked.length));
  return picked.sort((a, b) => data.eraIndex(a.era) - data.eraIndex(b.era)).map(q => q.id);
}

// 한능검 심화 합격선(1급 80, 2급 70, 3급 60)에 맞춰 나눠요.
const TIERS = [
  { min: 90, name: '장원 급제', note: '심화 1급, 그중에서도 수석이에요' },
  { min: 80, name: '갑과 급제', note: '심화 1급 실력이에요' },
  { min: 70, name: '을과 급제', note: '심화 2급 실력이에요' },
  { min: 60, name: '병과 급제', note: '심화 3급 실력이에요' },
  { min: 0, name: '낙방', note: '합격선 60점까지 조금만 더!' },
];
export const tierOf = rate => TIERS.find(t => rate >= t.min);

const appUrl = () => location.origin + location.pathname;
export const challengeUrl = (ids = [], vs = null) =>
  `${appUrl()}#/quiz?mode=test${ids.length ? `&ids=${ids.join(',')}` : ''}${vs != null ? `&vs=${vs}` : ''}`;

// 결과 화면의 홍패 카드. 해설을 많이 봐서 채점한 문제가 절반이 안 되면 칭호를 주지 않아요.
export function hongpaeHTML(r, rate) {
  const scored = r.scored ?? r.total;
  if (scored < Math.ceil(r.total / 2)) {
    return `<section class="card hongpae-skip"><p>해설을 보고 푼 문제가 많아서 이번에는 칭호를 드리지 않았어요. 해설 없이 다시 응시해 보세요.</p>
      <a class="btn btn-primary btn-block mt" href="#/quiz?mode=test">다시 응시하기</a></section>`;
  }
  const tier = tierOf(rate);
  return `<section class="hongpae ${tier.min ? '' : 'is-fail'}">
    <p class="hp-seal">紅牌</p>
    <p class="hp-sub">한능검 과거 시험장 · ${tier.min ? '급제 증서' : '낙방 통지'}</p>
    <p class="hp-tier">${esc(tier.name)}</p>
    <p class="hp-score">${scored}문항 중 ${r.correct}개 정답</p>
    <p class="hp-note">${esc(tier.note)}</p>
    <div class="stack hp-actions">
      <button type="button" class="btn btn-block hp-btn" data-act="hongpae">🖼 홍패 이미지 저장·공유</button>
      <button type="button" class="btn btn-block hp-btn-ghost" data-act="challenge">⚔️ 친구에게 같은 문제로 도전장 보내기</button>
    </div>
  </section>`;
}

// 인스타 스토리·단톡에 올리기 좋은 세로 이미지(1080×1920)
function hongpaeBlob(r, rate) {
  const tier = tierOf(rate);
  const scored = r.scored ?? r.total;
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1920;
  const g = c.getContext('2d');
  const sans = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const serif = '"AppleMyungjo", "Nanum Myeongjo", "Batang", serif';
  g.fillStyle = tier.min ? '#a3201f' : '#5b5f66';
  g.fillRect(0, 0, 1080, 1920);
  g.strokeStyle = '#e8c06a';
  g.lineWidth = 10;
  g.strokeRect(60, 60, 960, 1800);
  g.lineWidth = 3;
  g.strokeRect(84, 84, 912, 1752);
  g.textAlign = 'center';
  const line = (text, y, font, color) => { g.font = font; g.fillStyle = color; g.fillText(text, 540, y); };
  line('紅 牌', 400, `700 190px ${serif}`, '#e8c06a');
  line(`한능검 과거 시험장 · ${tier.min ? '급제 증서' : '낙방 통지'}`, 520, `600 44px ${sans}`, '#f6dfb0');
  line(tier.name, 860, `800 170px ${sans}`, '#ffffff');
  line(`${scored}문항 중 ${r.correct}개 정답`, 1000, `700 64px ${sans}`, '#ffffff');
  line(tier.note, 1090, `500 46px ${sans}`, '#f6dfb0');
  const d = new Date(r.at);
  line(`${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`, 1460, `500 44px ${sans}`, '#f6dfb0');
  line('나도 응시하기 👉 한국사 CBT', 1600, `700 52px ${sans}`, '#ffffff');
  line(appUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), 1680, `500 40px ${sans}`, '#f6dfb0');
  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

// 공유 시트가 있으면 이미지를 바로 보내고, 없으면 파일로 저장해요.
export async function shareHongpae(r, rate) {
  const blob = await hongpaeBlob(r, rate);
  const file = new File([blob], 'hongpae.png', { type: 'image/png' });
  const text = `${tierOf(rate).name}! 한능검 과거 시험 ${r.correct}/${r.scored ?? r.total}. 같은 문제로 겨뤄 볼래? ${challengeUrl(r.ids, r.correct)}`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancel';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hongpae.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}

export async function shareChallenge(text, url) {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancel';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'fail';
  }
}
