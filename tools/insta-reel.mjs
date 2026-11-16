// 인스타 릴스: 카드 PNG 폴더 → 9:16(1080×1920) 슬라이드 영상(MP4, 안 되면 WebM). 음악은 인스타 앱에서 붙여요.
// 쓰는 법: node tools/insta-reel.mjs <카드 폴더> [위 문구] [카드당 ms, 기본 3200]
// ffmpeg 없이 헤드리스 크롬의 MediaRecorder로 캔버스를 녹화해요.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const dir = path.resolve(process.argv[2] ?? '');
const top = process.argv[3] ?? '한능검 81회 · 11/28';
const HOLD_MS = Number(process.argv[4] ?? 3200); // 카드 한 장을 보여 주는 시간(글이 많으면 늘려요)
const cards = fs.readdirSync(dir).filter(f => /^card-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
if (!cards.length) throw new Error('card-N.png가 없어요: ' + dir);
const images = cards.map(f => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
const port = 9450 + Math.floor(Math.random() * 40);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 20 && !targets; i++) { await sleep(500); targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  // 카드마다 2.6초, 넘길 때 0.4초 밀어내기. 위 띠: 문구, 아래 띠: 링크 안내.
  const script = `(async () => {
    const imgs = await Promise.all(${JSON.stringify(images)}.map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })));
    const W = 1080, H = 1920, HOLD = ${HOLD_MS}, MOVE = 400, FPS = 30;
    const c = document.createElement('canvas'); c.width = W; c.height = H; document.body.append(c);
    const g = c.getContext('2d');
    const type = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(c.captureStream(FPS), { mimeType: type, videoBitsPerSecond: 8e6 });
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
    const frame = t => {
      g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1f4e79'; g.fillRect(0, 0, W, 250);
      g.fillStyle = '#fff'; g.font = 'bold 64px "Malgun Gothic"'; g.textAlign = 'center'; g.fillText(${JSON.stringify(top)}, W / 2, 150);
      const per = HOLD + MOVE, k = Math.min(imgs.length - 1, Math.floor(t / per)), p = t - k * per;
      const slide = k < imgs.length - 1 && p > HOLD ? (p - HOLD) / MOVE : 0;
      const y = 250 + (1420 - 1350) / 2;
      g.drawImage(imgs[k], -slide * W, y, W, 1350);
      if (slide) g.drawImage(imgs[k + 1], W - slide * W, y, W, 1350);
      g.fillStyle = '#1d232b'; g.fillRect(0, H - 250, W, 250);
      g.fillStyle = '#fff'; g.font = 'bold 54px "Malgun Gothic"'; g.fillText('무료 기출 CBT · 프로필 링크', W / 2, H - 140);
      g.font = '40px "Malgun Gothic"'; g.fillText('저장해 두고 시험 전에 다시 보기 📌', W / 2, H - 75);
    };
    const total = imgs.length * (HOLD + MOVE) - MOVE + 600;
    frame(0); rec.start(500);
    const t0 = performance.now();
    await new Promise(done => { const tick = () => { const t = performance.now() - t0; frame(t); t < total ? setTimeout(tick, 1000 / FPS) : done(); }; tick(); });
    rec.stop(); await new Promise(r => rec.onstop = r);
    const buf = new Uint8Array(await new Blob(chunks, { type }).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { type, b64: btoa(s), sec: total / 1000 };
  })()`;
  const res = await cmd('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: 120000 });
  const v = res.result?.result?.value;
  if (!v?.b64) throw new Error('녹화 실패: ' + JSON.stringify(res.result?.exceptionDetails ?? res).slice(0, 300));
  const out = path.join(dir, `릴스.${v.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
  fs.writeFileSync(out, Buffer.from(v.b64, 'base64'));
  console.log(JSON.stringify({ out, type: v.type, sec: v.sec, kb: Math.round(fs.statSync(out).size / 1024) }));
  ws.close();
} finally {
  chrome.kill();
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true });
}
