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
