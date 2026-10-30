// 매일 알림 보내기 — GitHub Actions(.github/workflows/push.yml)가 매시 17분에 돌려요.
// 고른 시각이 지났고 오늘 아직 안 받은 구독에만 하루 한 번 보내요. 우선순위: 전야제 > 기념일 > 오늘의 문제.
// 필요한 GitHub Secrets: SUPABASE_URL, SUPABASE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
import { readFile } from 'node:fs/promises';
import webpush from 'web-push';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.log('Secrets가 아직 없어서 건너뛰어요.');
  process.exit(0);
}
webpush.setVapidDetails('mailto:wjswoals1228@naver.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const read = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const [exams, anniversaries] = await Promise.all([read('exams'), read('anniversaries')]);

// 한국 시각
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const today = kst.toISOString().slice(0, 10);
const hour = kst.getUTCHours();
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

function message() {
  const exam = exams.find(e => addDays(e.date, -1) === today);
  if (exam) return { title: `🌙 제${exam.round}회 전야제`, body: '빈출 주제 50문제가 열렸어요. 내일 시험 전 마지막 점검!', url: '#/quiz?mode=eve' };
  const anniv = anniversaries.find(a => a.date === today.slice(5));
  if (anniv) return { title: `오늘은 ${anniv.name}`, body: '기념일 퀴즈 한 문제 풀고 가요', url: `#/quiz?mode=anniv&date=${anniv.date}` };
  const next = exams.find(e => e.date >= today);
  const dday = next ? Math.round((Date.parse(next.date) - Date.parse(today)) / 86400000) : null;
  return { title: dday != null ? `한능검 D-${dday} · 오늘의 문제` : '오늘의 한능검 문제', body: '사료 한 장, 1분이면 풀어요', url: '#/' };
}

// 새 secret 키(sb_secret_…)는 JWT가 아니라 apikey 헤더로만 보내요.
const headers = { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' };
const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });

const res = await rest(`push_subs?select=endpoint,p256dh,auth&hour=lte.${hour}&or=(last_sent.is.null,last_sent.lt.${today})`);
if (!res.ok) throw new Error(`구독 목록 ${res.status} ${await res.text()}`);
const subs = await res.json();
const payload = JSON.stringify(message());
let sent = 0, gone = 0, failed = 0;
for (const s of subs) {
  const key = `endpoint=eq.${encodeURIComponent(s.endpoint)}`;
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
    await rest(`push_subs?${key}`, { method: 'PATCH', body: JSON.stringify({ last_sent: today }) });
    sent += 1;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await rest(`push_subs?${key}`, { method: 'DELETE' });
      gone += 1;
    } else {
      failed += 1;
      console.error(err.statusCode, err.body ?? err.message);
    }
  }
}
console.log(`${today} ${hour}시: 대상 ${subs.length} · 보냄 ${sent} · 만료 삭제 ${gone} · 실패 ${failed}`);
