// 문제·기념일·시험 일정 데이터 (data/*.json)
import { addDays, daysBetween } from './dates.js';
import { SHOW_PAST } from './config.js';

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
  await loadFrequency();
  for (const q of db.byId.values()) q.field = fieldOf(q.topic);
  // 전야제 문제(eve: 회차)는 시험 전날부터 나와요.
  const eveOn = new Map(db.exams.map(e => [e.round, addDays(e.date, -1)]));
  for (const q of questions) if (q.eve) db.scheduledOn.set(q.id, eveOn.get(q.eve));
}

// ── 기출(개인용) ── data/past-*.json은 공개 저장소에 없어요(국사편찬위원회 이용 허락 전, .gitignore).
// 파일이 있을 때만 회차별 풀기·랜덤 기출 모의고사가 보여요.
async function loadPast() {
  if (!SHOW_PAST) return;
  try {
    const [exams, questions] = await Promise.all(['past-exams', 'past-questions'].map(async name => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(name);
      return res.json();
    }));
    db.pastExams = exams.filter(e => e.count === 50).sort((a, b) => b.round - a.round);
    // answer 0 = 이의 심사로 '정답 없음'(전원 정답) 처리된 문항이라 풀이에서 빼요.
    for (const p of questions.filter(x => x.answer > 0)) {
      db.byId.set(p.id, {
        ...p,
        question: p.stem || p.source,
        choices: Array.from({ length: p.choiceCount ?? 5 }, () => ''),
        source: `${p.source} (국사편찬위원회)`,
        explanation: `출처: 국사편찬위원회 한국사능력검정시험 ${p.source} 기출문제. 원본은 국사편찬위원회 한국사능력검정시험 누리집에서 무료로 받을 수 있어요.`,
        refs: ['https://www.historyexam.go.kr/pst/list.do?bbs=dat'],
        past: true,
      });
    }
    // 박사가 쓴 기출 해설(870KB)은 첫 화면을 늦추지 않게 뒤에서 받아 붙여요: { id: { keyPoint, explanation, choiceNotes } }
    fetch('data/past-notes.json').then(r => (r.ok ? r.json() : {})).then(notes => {
      for (const [id, note] of Object.entries(notes)) {
        const q = db.byId.get(id);
        if (q) Object.assign(q, note);
      }
    }).catch(() => {});
  } catch {
    db.pastExams = [];
  }
}

// ── 빈출 예측 ── data/frequency.json: 57~80회 심화 24번에서 주제마다 나온 횟수(박사 분석)
async function loadFrequency() {
  try {
    const res = await fetch('data/frequency.json');
    db.frequency = res.ok ? await res.json() : [];
  } catch {
    db.frequency = [];
  }
  // 문제마다 가장 많이 나온 주제를 붙여요(해설에 '기출 빈도'로 보여 줘요).
  for (const f of db.frequency) {
    for (const id of f.ids) {
      const q = db.byId.get(id);
      if (q && (!q.freq || q.freq.all < f.all)) q.freq = f;
    }
  }
}

export const frequency = () => db.frequency;
// 빈출 예상: 24번 중 20번 넘게 나왔거나 최근 늘어난 주제의 문제(전야제 문제는 그날 전까지 빼요)
export const isHot = f => Boolean(f) && (f.all >= 20 || f.trend === 'up');
export const hotPool = today => examPool(today).filter(q => isHot(q.freq));

// ── 분야(약점 분석용) ── 주제 이름의 낱말로 나눠요. 앞의 규칙이 먼저예요(예: '간도 참변'은 민족 운동).
export const FIELDS = ['정치·제도', '경제', '사회', '문화', '대외·전쟁', '민족 운동'];
const FIELD_WORDS = [
  ['민족 운동', ['독립', '의병', '의열단', '광복군', '무장 투쟁', '3·1 운동', '2·8', '신간회', '학생', '임시 정부', '임시정부', '애국 계몽', '신민회', '105인', '청산리', '봉오동', '자유시', '간도 참변', '김원봉', '윤봉길', '김구', '애국단', '의용대', '혁명군', '군정서', '의군부', '광복회', '국민 대표', '건국 강령', '물산 장려', '국채 보상', '민립 대학', '브나로드', '근우회', '형평']],
  ['경제', ['경제', '과전법', '전시과', '관료전', '균역법', '대동법', '상평통보', '장시', '신해통공', '회사령', '토지 조사', '농지 개혁', '금융 실명제', '외환 위기', '경부 고속', '벽란도', '청해진', '장보고', '진대법', '새마을', '전차', '경인선', '수취', '조세']],
  ['사회', ['사회', '봉기', '전봉준', '농민', '망이', '만적', '홍경래', '임술', '향약', '골품', '노비', '삼청', '영고', '무천', '책화', '소도', '민주화', '4·19', '부마', '6월', '호헌', '창씨', '징용', '징병', '민족 말살']],
  ['문화', ['문화', '불교', '승려', '역사서', '인쇄', '직지', '대장경', '훈민정음', '실학', '정약용', '박지원', '국학', '원효', '의천', '무애', '불국사', '석굴암', '화성', '서원', '신문', '순보', '원산 학사', '육영 공원', '어 학회', '진단 학회', '편수회', '근대 문물', '집현전', '규장각', '초계문신', '태학', '독서삼품과', '최치원', '고인돌', '토기', '빗살', '주먹도끼', '가락바퀴', '돌칼', '동검', '올림픽', '시대', '구석기', '천주교', '동학', '서학', '최제우', '단군']],
  ['대외·전쟁', ['전쟁', '침입', '왜란', '호란', '양요', '조약', '몽골', '거란', '여진', '별무반', '홍건적', '왜구', '을지문덕', '안시성', '강감찬', '처인성', '행주', '이순신', '북벌', '나선', '삼국 통일', '황산벌', '김춘추', '사절단', '보빙사', '영선사', '일본에 파견', '거문도', '독도', '간도', '외교', '인천 상륙', '흥남', '정전', '베트남', '늑약', '각서', '7조약', '국권 피탈', '수호', '척화비', '개항', '모스크바', '삼별초', '통일', '남북', '수·당', '위화도', '쌍성총관부', '정동행성', '원 간섭', '아관 파천']],
];
// 낱말 규칙에 안 맞는 주제는 따로 정해요.
const FIELD_OF_TOPIC = { 신문왕: '정치·제도', '문화 통치': '정치·제도', '3·15 부정': '사회' };
export function fieldOf(topic = '') {
  if (FIELD_OF_TOPIC[topic]) return FIELD_OF_TOPIC[topic];
  return FIELD_WORDS.find(([, words]) => words.some(w => topic.includes(w)))?.[0] ?? '정치·제도';
}

// 약점 문제 풀기: 연습 문제와 기출을 모두 써요.
export const practicePool = today => [...examPool(today), ...[...db.byId.values()].filter(q => q.past)];

export const pastExams = () => db.pastExams;
export const pastImageUrls = () => [...new Set([...db.byId.values()].filter(q => q.past).flatMap(q => [q.image, q.shared].filter(Boolean)))];
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
