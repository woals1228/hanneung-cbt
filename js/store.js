// 학습 기록은 이 기기(localStorage)에만 저장돼요.
import { todayStr, addDays } from './dates.js';

const KEY = 'hcbt.v1';
// 틀린 문제는 1일 → 3일 → 7일 뒤에 다시 나오고, 세 번 연달아 맞히면 완료예요.
const INTERVALS = [1, 3, 7];
export const REVIEW_STEPS = INTERVALS.length;

// examDraft: 시험 모드(모의고사), studyDraft: 학습 모드(오늘의 문제·기념일·시대별 등) — 풀던 답안이 앱을 꺼도 남아요.
const empty = () => ({ attempts: [], notebook: {}, favorites: {}, days: [], daily: null, exams: [], examDraft: null, studyDraft: null });

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('기록을 저장하지 못했어요', err);
  }
}

export const getState = () => state;

// viewed: 해설을 보고 푼 문제 — 기록은 남기지만 정답률과 복습 단계에는 넣지 않아요.
// pick: 고른 보기 번호(안 풀면 null) — 자주 고르는 오답을 볼 때 써요.
export function recordAnswer(qid, ok, mode, viewed = false, pick = null) {
  const today = todayStr();
  state.attempts.push({ q: qid, ok, mode, day: today, at: Date.now(), ...(pick != null && { pick }), ...(viewed && { viewed: true }) });
  if (!state.days.includes(today)) state.days.push(today);

  const item = state.notebook[qid];
  if (!ok) {
    state.notebook[qid] = {
      added: item?.added ?? today,
      wrong: (item?.wrong ?? 0) + 1,
      stage: 0,
      due: addDays(today, INTERVALS[0]),
      mastered: false,
      last: today,
    };
  } else if (!viewed && item && !item.mastered && item.due <= today) {
    // 복습 날짜가 된 문제를 (해설 없이) 맞혀야 다음 단계로 올라가요.
    item.stage += 1;
    if (item.stage >= INTERVALS.length) {
      item.mastered = true;
      item.due = null;
    } else {
      item.due = addDays(today, INTERVALS[item.stage]);
    }
  }
  save();
}

// 즐겨찾기: 다시 보고 싶은 문제 { 문제 id: 넣은 시각 }
export const isFavorite = qid => Boolean(state.favorites[qid]);
export const favoriteIds = () => Object.entries(state.favorites).sort((a, b) => b[1] - a[1]).map(([id]) => id);
export function toggleFavorite(qid) {
  if (state.favorites[qid]) delete state.favorites[qid];
  else state.favorites[qid] = Date.now();
  save();
  return isFavorite(qid);
}

export function notebookItems() {
  return Object.entries(state.notebook).map(([id, item]) => ({ id, ...item }));
}

export function dueIds(today = todayStr()) {
  return notebookItems()
    .filter(i => !i.mastered && i.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map(i => i.id);
}

export function removeFromNotebook(qid) {
  delete state.notebook[qid];
  save();
}

// 오늘 아직 안 풀었어도 어제까지 이어졌으면 연속 기록은 살아 있어요.
export function streak(today = todayStr()) {
  const days = new Set(state.days);
  const doneToday = days.has(today);
  let day = doneToday ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return { count, doneToday };
}

// 홈의 오늘의 1문제: { date, q, choice, viewed, graded }
export function dailyFor(date) {
  return state.daily?.date === date ? state.daily : null;
}

export function setDaily(date, qid, patch) {
  const current = state.daily?.date === date && state.daily.q === qid ? state.daily : { date, q: qid };
  state.daily = { ...current, ...patch };
  save();
}

const DRAFT_KEYS = { exam: 'examDraft', study: 'studyDraft' };

export const getDraft = mode => state[DRAFT_KEYS[mode]];

export function saveDraft(mode, draft) {
  state[DRAFT_KEYS[mode]] = draft;
  save();
}

export function addResult(result) {
  state.exams.push(result);
  state[DRAFT_KEYS[result.mode]] = null;
  save();
}

// ── 기록 백업 코드 ── 아이폰 사파리와 홈 화면 앱은 저장소가 따로라서, 코드로 기록을 옮겨요.
// 풀이 기록·목표·계획표와 익명 ID(서버 기록이 이어지게)를 JSON으로 묶어 base64로 만들어요.
const BACKUP_PREFIX = 'HCBT1:';
const BACKUP_KEYS = [KEY, 'hcbt.goal', 'hcbt.plan', 'hcbt.anon'];

const toBase64 = text => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export function exportBackup() {
  save();
  const data = {};
  for (const key of BACKUP_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value != null) data[key] = value;
    } catch {}
  }
  return BACKUP_PREFIX + toBase64(JSON.stringify({ app: 'hcbt', v: 1, at: Date.now(), data }));
}

// 잘못된 코드면 Error를 던져요. 성공하면 옮긴 기록 수를 돌려줘요.
export function readBackup(code) {
  const text = String(code ?? '').replace(/\s+/g, '');
  if (!text.startsWith(BACKUP_PREFIX)) throw new Error('한국사 CBT 백업 코드가 아니에요');
  let backup;
  try {
    backup = JSON.parse(fromBase64(text.slice(BACKUP_PREFIX.length)));
  } catch {
    throw new Error('코드가 잘렸거나 바뀌었어요. 처음부터 끝까지 다시 복사해 주세요');
  }
  if (backup?.app !== 'hcbt' || backup.v !== 1 || typeof backup.data?.[KEY] !== 'string') throw new Error('읽을 수 없는 백업 코드예요');
  const records = JSON.parse(backup.data[KEY]);
  if (!Array.isArray(records?.attempts)) throw new Error('읽을 수 없는 백업 코드예요');
  return { backup, attempts: records.attempts.length, exams: records.exams?.length ?? 0, at: backup.at };
}

export function restoreBackup({ backup }) {
  for (const key of BACKUP_KEYS) {
    if (typeof backup.data[key] === 'string') localStorage.setItem(key, backup.data[key]);
    else localStorage.removeItem(key);
  }
  state = load();
}

export function resetAll() {
  state = empty();
  save();
}
