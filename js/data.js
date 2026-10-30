// 문제·기념일·시험 일정 데이터 (data/*.json)
import { addDays, daysBetween } from './dates.js';

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
    pastExams: [],
  };
  await loadPast();
  // 전야제 문제(eve: 회차)는 시험 전날부터 나와요.
  const eveOn = new Map(db.exams.map(e => [e.round, addDays(e.date, -1)]));
  for (const q of questions) if (q.eve) db.scheduledOn.set(q.id, eveOn.get(q.eve));
}

// ── 기출(개인용) ── data/past-*.json은 공개 저장소에 없어요(국사편찬위원회 이용 허락 전, .gitignore).
// 파일이 있을 때만 회차별 풀기·랜덤 기출 모의고사가 보여요.
async function loadPast() {
  try {
    const [exams, questions] = await Promise.all(['past-exams', 'past-questions'].map(async name => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(name);
      return res.json();
    }));
    db.pastExams = exams.filter(e => e.count === 50).sort((a, b) => b.round - a.round);
    for (const p of questions) {
      db.byId.set(p.id, {
        ...p,
        question: p.stem || p.source,
        choices: Array.from({ length: p.choiceCount }, () => ''),
        explanation: `${p.source} 기출 문제예요.`,
        past: true,
      });
    }
  } catch {
    db.pastExams = [];
  }
}

export const pastExams = () => db.pastExams;
export const pastExamIds = examId => [...db.byId.values()].filter(q => q.past && q.exam === examId).sort((a, b) => a.no - b.no).map(q => q.id);

// 랜덤 기출 모의고사: 번호마다 여러 회차 중 하나를 골라요. 번호가 같으면 시대·난이도 자리가 비슷해서 실제 시험 흐름이 살아요.
export function randomPastSet(pick) {
  const exams = new Set(db.pastExams.map(e => e.id));
  const byNo = new Map();
  for (const q of db.byId.values()) {
    if (!q.past || !exams.has(q.exam)) continue;
    if (!byNo.has(q.no)) byNo.set(q.no, []);
    byNo.get(q.no).push(q.id);
  }
  return [...byNo.keys()].sort((a, b) => a - b).map(no => pick(byNo.get(no)));
}

// 날짜별 '오늘의 1문제'(data/daily.json)와 전야제 문제는 그날이 오기 전에는 다른 곳에 나오지 않아요.
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

// 전야제: 그 회차를 위해 새로 쓴 문제(eve: 회차)만, 시대 순서대로
export function eveQuestions(exam, today) {
  return availableQuestions(today)
    .filter(q => q.eve === exam?.round)
    .sort((a, b) => eraIndex(a.era) - eraIndex(b.era));
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
// 50문항을 채우려고 앞으로 나올 오늘의 문제도 써요. 전야제 문제만 그날 전까지 빼요.
export const examPool = today => db.questions.filter(q => !q.eve || db.scheduledOn.get(q.id) <= today);

export function buildExamSet(shuffle, today) {
  const all = examPool(today);
  const pool = all.length > EXAM_SIZE ? shuffle(all).slice(0, EXAM_SIZE) : all;
  return pool.sort((a, b) => eraIndex(a.era) - eraIndex(b.era)).map(q => q.id);
}
