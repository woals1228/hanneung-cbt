// 문제·기념일·시험 일정 데이터 (data/*.json)
import { daysBetween } from './dates.js';

export const ERAS = ['선사', '고대', '고려', '조선', '근대', '일제 강점기', '현대'];
export const EXAM_SIZE = 50;
export const EXAM_MINUTES = 80;

let db = null;

export async function loadData() {
  const names = ['questions', 'anniversaries', 'exams', 'daily'];
  const [questions, anniversaries, exams, daily] = await Promise.all(names.map(async name => {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`${name}.json: ${res.status}`);
    return res.json();
  }));
  db = {
    questions,
    anniversaries,
    exams: [...exams].sort((a, b) => a.date.localeCompare(b.date)),
    daily,
    scheduledOn: new Map(Object.entries(daily).map(([date, id]) => [id, date])),
    byId: new Map(questions.map(q => [q.id, q])),
  };
}

// 날짜별 '오늘의 1문제'(data/daily.json)는 그날이 오기 전에는 다른 곳에 나오지 않아요.
export function availableQuestions(today, { includeToday = true } = {}) {
  return db.questions.filter(q => {
    const on = db.scheduledOn.get(q.id);
    return !on || (includeToday ? on <= today : on < today);
  });
}

// '더 풀기' 후보: 날짜가 안 정해진 문제 + 이미 지난 날짜의 문제
export const morePool = today => availableQuestions(today, { includeToday: false });

export const allQuestions = () => db.questions;
export const allAnniversaries = () => db.anniversaries;
export const getQuestion = id => db.byId.get(id);
export const questionsByEra = era => db.questions.filter(q => q.era === era);
export const eraIndex = era => ERAS.indexOf(era);

export function anniversaryByDate(monthDay) {
  return db.anniversaries.find(a => a.date === monthDay) ?? null;
}

export function anniversaryOn(dateStr) {
  return anniversaryByDate(dateStr.slice(5));
}

// 기념일 문제 + related 로 연결한 다른 기념일 문제 (아직 날짜가 안 된 오늘의 문제는 빼요)
export function anniversaryQuestions(anniv, today) {
  const keys = [anniv.date, ...(anniv.related ?? [])];
  return availableQuestions(today).filter(q => keys.includes(q.anniversary));
}

// 오늘부터 가까운 순서 (올해 지난 기념일은 내년 날짜로 계산)
export function upcomingAnniversaries(today, count = 3) {
  const year = Number(today.slice(0, 4));
  return db.anniversaries
    .map(a => {
      let on = `${year}-${a.date}`;
      if (on < today) on = `${year + 1}-${a.date}`;
      return { ...a, on, days: daysBetween(today, on) };
    })
    .sort((x, y) => x.days - y.days)
    .slice(0, count);
}

export function nextExam(today) {
  return db.exams.find(e => e.date >= today) ?? null;
}

export function eveQuestions(exam, today) {
  const topics = exam?.eveTopics ?? [];
  return availableQuestions(today).filter(q => topics.includes(q.topic));
}

// 오늘의 문제: daily.json에 정해진 날은 모두에게 같은 문제, 그 밖의 날은 날짜로 정해지는 문제
export function dailyQuestion(today) {
  const fixed = db.byId.get(db.daily[today]);
  if (fixed) return fixed;
  const pool = availableQuestions(today);
  let h = 2166136261;
  for (const ch of today) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return pool[h % pool.length];
}

// 실전 모의고사: 최대 50문항을 시대 순서대로 (실제 시험처럼 선사 → 현대)
export function buildExamSet(shuffle, today) {
  const all = availableQuestions(today);
  const pool = all.length > EXAM_SIZE ? shuffle(all).slice(0, EXAM_SIZE) : all;
  return pool.sort((a, b) => eraIndex(a.era) - eraIndex(b.era)).map(q => q.id);
}
