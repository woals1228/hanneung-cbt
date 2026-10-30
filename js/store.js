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
export function recordAnswer(qid, ok, mode, viewed = false) {
  const today = todayStr();
  state.attempts.push({ q: qid, ok, mode, day: today, at: Date.now(), ...(viewed && { viewed: true }) });
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

export function resetAll() {
  state = empty();
  save();
}
