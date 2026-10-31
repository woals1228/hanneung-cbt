// 문제 데이터 검사: npm run check
import { readFile } from 'node:fs/promises';

// js/data.js 의 ERAS 와 같아야 해요.
const ERAS = ['선사', '고대', '고려', '조선', '근대', '일제 강점기', '현대'];

const read = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const [questions, anniversaries, exams, daily] = await Promise.all(['questions', 'anniversaries', 'exams', 'daily'].map(read));

const errors = [];
const warnings = [];
const GENERIC_WORDS = ['봉기', '운동', '전쟁', '정부', '시대', '문화', '경제', '사회', '정책', '단체', '사건'];
const ids = new Set();
const annivDates = new Set(anniversaries.map(a => a.date));
const rounds = new Set(exams.map(e => e.round));

for (const [i, q] of questions.entries()) {
  const at = q.id ?? `${i + 1}번째 문제`;
  if (!q.id) errors.push(`${at}: id가 없어요`);
  else if (ids.has(q.id)) errors.push(`${at}: id가 중복돼요`);
  ids.add(q.id);
  if (!ERAS.includes(q.era)) errors.push(`${at}: era "${q.era}"는 ${ERAS.join(', ')} 중 하나여야 해요`);
  if (!q.topic) errors.push(`${at}: topic이 없어요`);
  if (!q.question) errors.push(`${at}: question이 없어요`);
  if (!Array.isArray(q.choices) || q.choices.length !== 5) errors.push(`${at}: 보기(choices)는 5개여야 해요`);
  else if (new Set(q.choices).size !== 5) errors.push(`${at}: 같은 보기가 두 번 있어요`);
  if (!Number.isInteger(q.answer) || q.answer < 1 || q.answer > 5) errors.push(`${at}: answer는 1~5 사이 숫자여야 해요`);
  if (![1, 2, 3].includes(q.points)) errors.push(`${at}: points는 1, 2, 3 중 하나여야 해요`);
  if (!q.explanation) errors.push(`${at}: explanation(해설)이 없어요`);
  if (q.anniversary && !annivDates.has(q.anniversary)) errors.push(`${at}: anniversary "${q.anniversary}"가 anniversaries.json에 없어요`);
  if (q.eve != null && !rounds.has(q.eve)) errors.push(`${at}: eve ${q.eve}회가 exams.json에 없어요`);
  if (q.passage != null && (typeof q.passage !== 'string' || !q.passage.trim())) errors.push(`${at}: passage(자료)는 빈 글이면 안 돼요`);
  if (q.choiceNotes != null && (!Array.isArray(q.choiceNotes) || q.choiceNotes.length !== 5 || q.choiceNotes.some(n => typeof n !== 'string' || !n.trim()))) errors.push(`${at}: choiceNotes는 보기마다 한 줄씩 5개여야 해요`);
  if (q.keyPoint != null && typeof q.keyPoint !== 'string') errors.push(`${at}: keyPoint는 글이어야 해요`);
  if (q.passage && q.topic && q.question.includes(q.topic)) warnings.push(`${at}: 질문에 주제 "${q.topic}"가 그대로 나와요(사료형이면 (가)로 가려요)`);
  // 난이도(10/31 사용자 피드백): 실제 심화처럼 자료는 간접 단서로, 보기는 '그 시기의 사실'로 써요.
  // '봉기·운동'처럼 질문에 흔히 쓰는 말과 '4·19'의 '19' 같은 숫자 조각은 빼고 봐요.
  const topicWords = (q.topic ?? '').split(/[·\s()]/).filter(w => w.length >= 2 && !/^d+$/.test(w) && !GENERIC_WORDS.includes(w));
  if (q.passage && topicWords.some(w => q.passage.includes(w) || q.question.includes(w))) warnings.push(`${at}: 자료나 질문에 주제 "${q.topic}"가 그대로 나와서 답이 쉽게 보여요`);
  if (q.passage && Array.isArray(q.choices) && q.choices.every(c => c.length <= 8)) warnings.push(`${at}: 보기가 이름뿐인 1단계 문제예요('그 시기에 있었던 사실'로 바꿔요)`);
  if (q.refs != null && (!Array.isArray(q.refs) || q.refs.some(u => typeof u !== 'string' || !u.startsWith('https://')))) errors.push(`${at}: refs는 https:// 주소 배열이어야 해요`);
}

for (const a of anniversaries) {
  if (!/^\d{2}-\d{2}$/.test(a.date)) errors.push(`기념일 ${a.name}: date는 "MM-DD" 형식이어야 해요`);
  for (const r of a.related ?? []) if (!annivDates.has(r)) errors.push(`기념일 ${a.name}: related "${r}"가 없어요`);
}

for (const e of exams) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`제${e.round}회: date는 "YYYY-MM-DD" 형식이어야 해요`);
  const eveCount = questions.filter(q => q.eve === e.round).length;
  if (e.date >= new Date().toISOString().slice(0, 10) && !eveCount) warnings.push(`제${e.round}회 전야제 문제(eve: ${e.round})가 아직 없어요`);
}

const scheduled = new Set();
for (const [date, id] of Object.entries(daily)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`daily.json ${date}: 날짜는 "YYYY-MM-DD" 형식이어야 해요`);
  if (!ids.has(id)) errors.push(`daily.json ${date}: 문제 "${id}"가 없어요`);
  if (scheduled.has(id)) errors.push(`daily.json ${date}: 문제 "${id}"가 두 날짜에 들어 있어요`);
  if (questions.find(q => q.id === id)?.eve) errors.push(`daily.json ${date}: 전야제 문제 "${id}"는 오늘의 문제로 쓸 수 없어요`);
  scheduled.add(id);
}

const answerCounts =[1, 2, 3, 4, 5].map(n => questions.filter(q => q.answer === n).length);
const eveTotal = questions.filter(q => q.eve).length;
console.log(`문제 ${questions.length}개 · 기념일 ${anniversaries.length}개 · 시험 ${exams.length}회 · 날짜별 문제 ${scheduled.size}개 · 전야제 ${eveTotal}개 (나머지 ${questions.length - scheduled.size - eveTotal}개는 더 풀기용)`);
console.log(`사료형 ${questions.filter(q => q.passage).length}개 / ${questions.length}개`);
console.log(`정답 번호 분포: ${answerCounts.map((c, i) => `${i + 1}번 ${c}개`).join(', ')}`);
for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ 문제 없어요');
