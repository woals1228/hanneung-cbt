// 날짜는 모두 'YYYY-MM-DD' 문자열로 다뤄요.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const OVERRIDE_KEY = 'hcbt.today';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

// 테스트용: 주소 뒤에 ?today=2026-11-27 을 붙이거나 설정에서 날짜를 바꾸면 그날처럼 동작해요.
const fromUrl = new URLSearchParams(location.search).get('today');
if (fromUrl && DATE_RE.test(fromUrl)) setDateOverride(fromUrl);

export function setDateOverride(value) {
  try {
    if (value) sessionStorage.setItem(OVERRIDE_KEY, value);
    else sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // 저장소를 못 쓰는 환경에서는 실제 날짜만 써요.
  }
}

export function dateOverride() {
  try {
    const value = sessionStorage.getItem(OVERRIDE_KEY);
    return value && DATE_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 폰 시간대와 상관없이 한국 날짜로 계산해요 (서버 기록도 한국 날짜예요). en-CA 형식이 YYYY-MM-DD예요.
const SEOUL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

export function todayStr() {
  return dateOverride() ?? SEOUL_DATE.format(new Date());
}

function toUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(str, days) {
  const t = new Date(toUTC(str) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function weekday(str) {
  return WEEKDAYS[new Date(toUTC(str)).getUTCDay()];
}

// 10월 23일 (금)
export function formatLong(str) {
  const [, m, d] = str.split('-').map(Number);
  return `${m}월 ${d}일 (${weekday(str)})`;
}

// 11.28(토)
export function formatShort(str) {
  const [, m, d] = str.split('-').map(Number);
  return `${m}.${d}(${weekday(str)})`;
}

export function dday(days) {
  if (days === 0) return 'D-Day';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}
