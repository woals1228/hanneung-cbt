// 수요 시험 기록: 무작위 ID + 그날 한 행동의 종류만 보내요 (privacy.html 참고).
// 서버(log_event)가 한국 날짜로 하루 한 줄만 남기니, 여기서는 같은 화면에서 반복해 보내지 않게만 막아요.
import { dateOverride, todayStr } from './dates.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const ID_KEY = 'hcbt.anon';
const PUBLIC_HOST = 'woals1228.github.io';
// 유입 채널: 홍보 링크의 ?s=코드 를 첫 방문 때 기억해요(supabase/source.sql).
const SRC_KEY = 'hcbt.src';
const SOURCES = ['et', 'cafe', 'kakao', 'blog', 'orbi', 'insta', 'etc'];
try {
  const s = new URLSearchParams(location.search).get('s');
  if (SOURCES.includes(s) && !localStorage.getItem(SRC_KEY)) localStorage.setItem(SRC_KEY, s);
} catch {}
const source = () => {
  try { return localStorage.getItem(SRC_KEY); } catch { return null; }
};
const sent = new Set();
const ua = navigator.userAgent;

export const isAndroid = /android/i.test(ua);
export const isKakao = /KAKAOTALK/i.test(ua);

export const platform = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(ua) ? 'inapp'
  : isAndroid ? 'android'
  : /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios'
  : 'other';

function anonId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(kind) {
  // 공개 주소에서만 보내요. 테스트용 날짜, 내 컴퓨터, 개인용(기출) 앱의 기록이 측정에 섞이지 않게 해요.
  if (!SUPABASE_URL || !SUPABASE_KEY || dateOverride() || location.hostname !== PUBLIC_HOST) return;
  const key = `${todayStr()}:${kind}`;
  const id = anonId();
  if (!id || sent.has(key)) return;
  sent.add(key);
  // publishable 키는 apikey 헤더만으로 돼요(10/30 실제 프로젝트에서 204 확인).
  const send = body => fetch(`${SUPABASE_URL}/rest/v1/rpc/log_event`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  const body = { p_anon: id, p_kind: kind, p_platform: platform };
  const src = source();
  // 채널 코드를 받는 서버(supabase/source.sql)가 아직 없으면 코드 없이 다시 보내서 기록이 빠지지 않게 해요.
  (src ? send({ ...body, p_src: src }).then(r => r.ok || send(body)) : send(body)).catch(() => {});
}

// ── 풀이 기록(supabase/answers.sql) ── 채점한 문제마다 익명 ID·문항·고른 보기·맞음·시대·분야를 보내요.
// 한 번에 묶어 보내고, 실패해도 앱은 그대로예요.
const ANSWER_BATCH = 60;
export function logAnswers(mode, rows) {
  if (!SUPABASE_URL || !SUPABASE_KEY || dateOverride() || location.hostname !== PUBLIC_HOST || !rows.length) return;
  const id = anonId();
  if (!id) return;
  const list = rows.map(({ q, pick, ok, viewed }) => ({ qid: q.id, pick: pick ?? 0, ok, viewed, era: q.era, field: q.field }));
  for (let i = 0; i < list.length; i += ANSWER_BATCH) {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_answers`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ p_anon: id, p_mode: mode, p_rows: list.slice(i, i + ANSWER_BATCH) }),
    }).catch(() => {});
  }
}

// 문항별 전체 정답률: { n, ok, picks: [①~⑤ 고른 수] } — 응시가 적으면 null
const statsCache = new Map();
export function questionStats(qid) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return Promise.resolve(null);
  if (!statsCache.has(qid)) {
    statsCache.set(qid, fetch(`${SUPABASE_URL}/rest/v1/rpc/question_stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ p_qid: qid }),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null));
  }
  return statsCache.get(qid);
}
