// 박사가 고쳐 쓴 문제(team/난이도-*.json)를 data/questions.json에 id로 덮어써요. 사용: node tools/merge-revised.js <파일>...
import fs from 'fs';

const path = 'data/questions.json';
const questions = JSON.parse(fs.readFileSync(path, 'utf8'));
const index = new Map(questions.map((q, i) => [q.id, i]));
let n = 0;
for (const file of process.argv.slice(2)) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const q of Array.isArray(raw) ? raw : Object.values(raw).flat()) {
    if (!index.has(q.id)) {
      console.warn(`없는 id라 건너뛰어요: ${q.id}`);
      continue;
    }
    // 날짜·전야제처럼 박사가 안 바꾸는 칸은 그대로 두고 덮어써요.
    questions[index.get(q.id)] = { ...questions[index.get(q.id)], ...q };
    n += 1;
  }
}
fs.writeFileSync(path, JSON.stringify(questions, null, 2) + '\n');
console.log(`${n}개 바꿨어요`);
