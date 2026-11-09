// 인스타 주간 묶음: 게시물 3개(빈출 개념·헷갈리는 짝·사료 퀴즈) 카드 PNG(1080×1350)와 캡션을 만들어요.
// 쓰는 법: node tools/insta-pack.mjs <출력 폴더>   (예: ../team/인스타/2026-W46)
// 이미 쓴 주제·문제는 ../team/인스타/used.json에 남겨서 다음 주에 겹치지 않게 해요.
// 내용은 우리 데이터(개념 카드·사료형 문제)만 써요. 기출 문장·이미지는 넣지 않아요.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USED = path.resolve(APP, '../team/인스타/used.json');
const LINK = 'https://woals1228.github.io/hanneung-cbt/?s=insta';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const read = f => JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));

const out = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('출력 폴더를 주세요');
fs.mkdirSync(out, { recursive: true });

const concepts = read('data/concepts.json');
const freq = new Map(read('data/frequency.json').map(f => [f.topic, f]));
const questions = read('data/questions.json').filter(q => q.passage && !q.eve);
const used = fs.existsSync(USED) ? JSON.parse(fs.readFileSync(USED, 'utf8')) : { topics: [], pairs: [], quiz: [] };
const all = c => freq.get(c.topic)?.all ?? 0;
const byFreq = [...concepts].sort((a, b) => all(b) - all(a));

// ① 빈출 개념: 아직 안 쓴 주제 중 가장 많이 나온 것
const c1 = byFreq.find(c => !used.topics.includes(c.topic));
// ② 헷갈리는 짝: 상대도 카드가 있는 짝, 안 쓴 것
const pairKey = (a, b) => [a, b].sort().join('|');
const p2 = byFreq.flatMap(c => (c.pairs ?? []).map(p => ({ a: c, b: concepts.find(x => x.topic === p.with), tip: p.tip })))
  .find(x => x.b && x.a.topic !== c1.topic && !used.pairs.includes(pairKey(x.a.topic, x.b.topic)));
// ③ 사료 퀴즈: 빈출 주제의 우리 사료형 문제, 안 쓴 것
const q3 = questions.filter(q => !used.quiz.includes(q.id)).sort((a, b) => (freq.get(b.topic)?.all ?? 0) - (freq.get(a.topic)?.all ?? 0))[0];

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const kw = k => { const [a, ...b] = k.split('→'); return b.length ? `<b>${esc(a.trim())}</b><span>→ ${esc(b.join('→').trim())}</span>` : esc(k); };
const page = (body, n, total) => `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1080px;height:1350px;background:#f6f4ef;color:#1d232b;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;padding:96px 88px;display:flex;flex-direction:column}
.tag{color:#1f4e79;font-size:34px;font-weight:700}.big{font-size:84px;font-weight:800;line-height:1.25;margin:28px 0}.sub{font-size:40px;color:#5d6876;line-height:1.5}
.box{background:#fff;border-radius:32px;padding:48px;margin-top:36px;font-size:40px;line-height:1.6}.list{display:grid;gap:26px}.list div{display:flex;flex-direction:column}.list b{color:#1f4e79}.list span{font-size:36px}
.trap{background:#f7e4e2;color:#b23a3a}.ans{background:#1f4e79;color:#fff}.grow{flex:1}.foot{display:flex;justify-content:space-between;font-size:30px;color:#5d6876}
.choices{display:grid;gap:18px;font-size:38px}.choices div{background:#fff;border-radius:20px;padding:22px 30px}</style>
<div class="grow">${body}</div><div class="foot"><span>한능검 CBT · 무료 기출 CBT</span><span>${n}/${total}</span></div>`;

function shoot(dir, name, html) {
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(dir, `${name}.png`)}`, '--window-size=1080,1350', `file:///${file.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  fs.unlinkSync(file);
}

function post(dir, slides, caption) {
  fs.mkdirSync(dir, { recursive: true });
  slides.forEach((s, i) => shoot(dir, `card-${i + 1}`, page(s, i + 1, slides.length)));
  fs.writeFileSync(path.join(dir, '캡션.txt'), caption);
}

const CTA = `<p class="tag">무료로 더 풀기</p><p class="big">기출 24회<br>실전 CBT</p><p class="sub">보기마다 틀린 이유 해설<br>틀린 문제는 1·3·7일 뒤 자동 복습</p>
  <div class="box">프로필 링크 → <b>사파리·크롬으로 열기</b><br>→ 홈 화면에 추가</div>`;
const TAGS = '#한능검 #한국사능력검정시험 #한능검심화 #한능검81회 #한국사 #한국사공부 #공스타그램 #공시생 #취준생';
const tail = `\n\n📌 저장해 두고 시험 전에 다시 보기\n👉 무료 CBT는 프로필 링크에서 (⋯ → 외부 브라우저로 열기)\n\n${TAGS}`;

// ① 빈출 개념
const f1 = freq.get(c1.topic);
post(path.join(out, '1-빈출개념'), [
  `<p class="tag">최근 24회 중 ${f1?.all ?? '?'}회 출제</p><p class="big">${esc(c1.topic)}</p><p class="sub">${esc(c1.era)} · ${esc(c1.years ?? '')}<br>한 장으로 끝내기</p>`,
  `<p class="tag">흐름 한 줄</p><div class="box">${esc(c1.flow)}</div>`,
  `<p class="tag">꼭 외울 키워드</p><div class="box list">${c1.keywords.slice(0, 4).map(k => `<div>${kw(k)}</div>`).join('')}</div>`,
  ...(c1.keywords.length > 4 ? [`<p class="tag">꼭 외울 키워드 (이어서)</p><div class="box list">${c1.keywords.slice(4).map(k => `<div>${kw(k)}</div>`).join('')}</div>`] : []),
  ...(c1.trap ? [`<p class="tag">⚠️ 함정</p><div class="box trap">${esc(c1.trap)}</div>`] : []),
  CTA,
], `한능검 심화 최근 24회 중 ${f1?.all ?? '?'}회 나온 주제, ${c1.topic} 한 장 정리 📘\n\n${c1.flow}${tail}`);

// ② 헷갈리는 짝
post(path.join(out, '2-헷갈리는짝'), [
  `<p class="tag">시험에서 자주 섞이는 짝</p><p class="big">${esc(p2.a.topic)}<br>vs ${esc(p2.b.topic)}</p><p class="sub">한 줄로 구별해요</p>`,
  `<p class="tag">구별 한 줄</p><div class="box">${esc(p2.tip)}</div>`,
  `<p class="tag">${esc(p2.a.topic)}</p><div class="box list">${p2.a.keywords.slice(0, 3).map(k => `<div>${kw(k)}</div>`).join('')}</div>`,
  `<p class="tag">${esc(p2.b.topic)}</p><div class="box list">${p2.b.keywords.slice(0, 3).map(k => `<div>${kw(k)}</div>`).join('')}</div>`,
  CTA,
], `${p2.a.topic} vs ${p2.b.topic}, 헷갈리면 이것만 기억해요 🤔\n\n${p2.tip}${tail}`);

// ③ 사료 퀴즈
const C = ['①', '②', '③', '④', '⑤'];
post(path.join(out, '3-사료퀴즈'), [
  `<p class="tag">오늘의 사료 퀴즈 · ${esc(q3.era)}</p><div class="box" style="margin-top:24px;padding:36px;font-size:36px">${esc(q3.passage)}</div><p class="sub" style="margin:28px 0;color:#1d232b;font-weight:700">${esc(q3.question)}</p><div class="choices">${q3.choices.map((c, i) => `<div>${C[i]} ${esc(c)}</div>`).join('')}</div><p class="sub" style="margin-top:24px">정답은 다음 장에 👉</p>`,
  `<p class="tag">정답</p><div class="box ans">${C[q3.answer - 1]} ${esc(q3.choices[q3.answer - 1])}</div><div class="box">${esc(q3.keyPoint ?? q3.explanation)}</div>`,
  CTA,
], `오늘의 사료 퀴즈 ✍️ 정답 번호를 댓글로 남겨 보세요!\n\n(${q3.era} · ${q3.topic})${tail}`);

used.topics.push(c1.topic);
used.pairs.push(pairKey(p2.a.topic, p2.b.topic));
used.quiz.push(q3.id);
fs.writeFileSync(USED, JSON.stringify(used, null, 1));
console.log(JSON.stringify({ out, concept: c1.topic, pair: `${p2.a.topic} vs ${p2.b.topic}`, quiz: q3.id }));
