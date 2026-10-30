// 매일 알림(웹 푸시). 아이폰은 홈 화면에 추가한 앱에서만 돼요.
import { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY } from './config.js';

const HOUR_KEY = 'hcbt.pushHour';
export const DEFAULT_HOUR = 20;

export const pushReady = () => Boolean(VAPID_PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const savedHour = () => {
  try { return Number(localStorage.getItem(HOUR_KEY) ?? DEFAULT_HOUR); } catch { return DEFAULT_HOUR; }
};

async function rpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
}

function keyBytes(base64url) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushReady()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribe(hour) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const { endpoint, keys } = sub.toJSON();
  await rpc('save_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_hour: hour });
  try { localStorage.setItem(HOUR_KEY, String(hour)); } catch {}
}

export async function unsubscribe() {
  const sub = await currentSubscription();
  if (!sub) return;
  await rpc('delete_push', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
