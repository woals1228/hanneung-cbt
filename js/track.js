// 수요 시험 기록: 무작위 ID + 그날 한 행동의 종류만 보내요 (privacy.html 참고).
// 서버(log_event)가 한국 날짜로 하루 한 줄만 남기니, 여기서는 같은 화면에서 반복해 보내지 않게만 막아요.
import { dateOverride, todayStr } from './dates.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const ID_KEY = 'hcbt.anon';
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
  // 테스트용 날짜를 쓰는 중이거나 내 컴퓨터(localhost)에서 열면 측정을 더럽히지 않게 보내지 않아요.
  if (!SUPABASE_URL || !SUPABASE_KEY || dateOverride() || ['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const key = `${todayStr()}:${kind}`;
  const id = anonId();
  if (!id || sent.has(key)) return;
  sent.add(key);
  // shortcut: apikey 헤더만 보내요. publishable 키와 예전 anon 키 둘 다 이걸로 되는지 실제 프로젝트에서 한 번 확인해야 해요.
  fetch(`${SUPABASE_URL}/rest/v1/rpc/log_event`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ p_anon: id, p_kind: kind, p_platform: platform }),
  }).catch(() => {});
}
