// 박사가 쓴 기출 해설(team/기출-해설/*.json)을 data/past-notes.json 하나로 합쳐요: node tools/merge-past-notes.js
import { readdir, readFile, writeFile } from 'node:fs/promises';

const dir = new URL('../../team/기출-해설/', import.meta.url);
const ids = new Set(JSON.parse(await readFile(new URL('../data/past-questions.json', import.meta.url), 'utf8')).map(q => q.id));
const notes = {};
for (const name of (await readdir(dir)).filter(n => n.endsWith('.json')).sort()) {
  for (const n of JSON.parse(await readFile(new URL(name, dir), 'utf8'))) {
    if (!ids.has(n.id)) throw new Error(`${name}: 없는 문항 ${n.id}`);
    if (!n.explanation || (n.choiceNotes && n.choiceNotes.length !== 5)) throw new Error(`${name}: ${n.id} 해설 형식`);
    notes[n.id] = { keyPoint: n.keyPoint, explanation: n.explanation, choiceNotes: n.choiceNotes };
  }
}
await writeFile(new URL('../data/past-notes.json', import.meta.url), JSON.stringify(notes));
console.log(`기출 해설 ${Object.keys(notes).length}문항`);
