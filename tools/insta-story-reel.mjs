// 인스타 '흐름 시리즈' 릴스: 대본 JSON → 9:16 MP4 (연표 애니메이션 + 윈도우 한국어 음성 내레이션).
// 쓰는 법: node tools/insta-story-reel.mjs <대본.json> [--mute]
//   대본: { top, hook:{text,say}, steps:[{year,title,line,say}], recap:{items:[], say}, next:{text,say} }
// 결과: 대본 옆에 릴스-흐름.mp4(음성), 릴스-흐름-무음.mp4(인스타 음악·TTS를 따로 붙일 때). ffmpeg 없이 크롬 MediaRecorder로 녹화해요.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';

const file = path.resolve(process.argv[2] ?? '');
const S = JSON.parse(fs.readFileSync(file, 'utf8'));
const outDir = path.dirname(file);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 장면 목록: 훅 → 단계들 → 기억할 말 → 다음 이야기
// '몰랐던 사실' 시리즈는 S.scenes로 장면을 직접 줘요(kind: hook·pop·recap·next).
const scenes = S.scenes ?? [{ kind: 'hook', ...S.hook }, ...S.steps.map((s, i) => ({ kind: 'step', i, ...s })), { kind: 'recap', ...S.recap }, { kind: 'next', ...S.next }];

// 윈도우 음성(Heami)으로 장면마다 wav를 만들어요.
const ps = scenes.map((s, i) => `$s.SetOutputToWaveFile('${path.join(tmp, `${i}.wav`)}'); $s.Speak(${JSON.stringify(s.say ?? '')});`).join('\n');
fs.writeFileSync(path.join(tmp, 'tts.ps1'), `\uFEFFAdd-Type -AssemblyName System.Speech\n$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$s.SelectVoice('Microsoft Heami Desktop')\n$s.Rate = 4\n${ps}\n$s.Dispose()`, 'utf8');
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(tmp, 'tts.ps1')], { stdio: 'inherit' });
const wavs = scenes.map((_, i) => 'data:audio/wav;base64,' + fs.readFileSync(path.join(tmp, `${i}.wav`)).toString('base64'));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const port = 9500 + Math.floor(Math.random() * 40);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(tmp, 'p')}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });

async function record(withVoice) {
  let targets;
  for (let i = 0; i < 20 && !targets; i++) { await sleep(500); targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const script = `(async () => {
    const S = ${JSON.stringify(S)}, scenes = ${JSON.stringify(scenes)}, wavs = ${JSON.stringify(wavs)}, VOICE = ${withVoice};
    const ac = new AudioContext(); await ac.resume();
    const bufs = await Promise.all(wavs.map(u => fetch(u).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b))));
    // 장면 길이 = 음성 길이 + 여유(최소 길이 보장)
    const MIN = { hook: 2.2, step: 3.2, pop: 3, recap: 3.5, next: 3 };
    const dur = scenes.map((s, i) => Math.max(MIN[s.kind], bufs[i].duration + 0.45));
    const starts = dur.map((_, i) => dur.slice(0, i).reduce((a, b) => a + b, 0));
    const total = starts.at(-1) + dur.at(-1) + 0.3;
    const W = 1080, H = 1920, FPS = 30, C = { bg: '#f6f4ef', ink: '#1d232b', pri: '#1f4e79', soft: '#e3ecf5', acc: '#b23a3a', mute: '#5d6876' };
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const F = (w, s) => \`\${w} \${s}px "Malgun Gothic"\`;
    const wrap = (text, x, y, maxW, lh) => { let line = ''; for (const ch of text) { if (g.measureText(line + ch).width > maxW) { g.fillText(line, x, y); y += lh; line = ch.trim() ? ch : ''; } else line += ch; } g.fillText(line, x, y); return y + lh; };
    const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    function frame(t) {
      const k = Math.max(0, starts.findLastIndex(s => s <= t)), s = scenes[k], p = t - starts[k];
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.textAlign = 'left';
      g.fillStyle = C.pri; g.fillRect(0, 0, W, 200); g.fillStyle = '#fff'; g.font = F('bold', 50); g.textAlign = 'center'; g.fillText(S.top, W / 2, 120); g.textAlign = 'left';
      if (s.kind === 'hook') {
        g.fillStyle = C.ink; g.font = F('900', 96); g.textAlign = 'center';
        const lines = s.text.split('\\n'); lines.forEach((l, i) => { g.globalAlpha = ease(p * 2 - i * 0.4); g.fillText(l, W / 2, 820 + i * 130); }); g.globalAlpha = 1;
      } else if (s.kind === 'step') {
        // 왼쪽 연표 막대: 지나간 단계는 진하게, 지금 단계는 강조
        const n = S.steps.length, top = 330, gap = Math.min(190, 1250 / n);
        g.fillStyle = '#d9d4c8'; g.fillRect(118, top, 8, gap * (n - 1));
        S.steps.forEach((st, i) => { const y = top + i * gap; const on = i <= s.i; g.fillStyle = i === s.i ? C.acc : on ? C.pri : '#cfc9bc'; g.beginPath(); g.arc(122, y, i === s.i ? 26 : 16, 0, 7); g.fill(); g.font = F(i === s.i ? 'bold' : '600', i === s.i ? 44 : 34); g.fillStyle = on ? C.ink : '#b3ad9f'; g.fillText(st.year, 170, y + 14); });
        const a = ease(p * 2.5), x = 430 + (1 - a) * 80; g.globalAlpha = a;
        g.fillStyle = C.acc; g.font = F('900', 150); g.fillText(s.year, x, 700);
        g.fillStyle = C.ink; g.font = F('bold', 74); const y2 = wrap(s.title, x, 840, W - x - 60, 92);
        g.fillStyle = C.mute; g.font = F('500', 46); wrap(s.line, x, y2 + 30, W - x - 60, 66); g.globalAlpha = 1;
        g.fillStyle = C.pri; g.font = F('bold', 40); g.textAlign = 'center'; g.fillText(\`\${s.i + 1} / \${n}\`, W / 2, H - 300);
      } else if (s.kind === 'pop') {
        // 이모지가 통통 튀어 들어오고, 큰 글자 → 설명 순서로 나타나요.
        const sp = p < 0.6 ? 1 + Math.sin(p / 0.6 * Math.PI) * 0.25 * (1 - p / 0.6) : 1, sc = ease(p * 3) * sp;
        g.textAlign = 'center'; g.save(); g.translate(W / 2, 640); g.scale(sc, sc); g.rotate(Math.sin(p * 5) * 0.06); g.font = F('', 300); g.fillText(s.emoji ?? '💡', 0, 100); g.restore();
        g.globalAlpha = ease(p * 2.5 - 0.6); g.fillStyle = s.color === 'acc' ? C.acc : C.ink; g.font = F('900', 88);
        let y = 1000; s.text.split('\\n').forEach(l => { g.fillText(l, W / 2, y); y += 112; });
        g.globalAlpha = ease(p * 2.5 - 1.2); g.fillStyle = C.mute; g.font = F('500', 48); s.line && wrap(s.line, W / 2, y + 20, W - 200, 68); g.globalAlpha = 1;
      } else if (s.kind === 'recap') {
        g.fillStyle = C.pri; g.font = F('900', 80); g.textAlign = 'center'; g.fillText(s.title ?? '📌 기억할 말', W / 2, 420);
        s.items.forEach((it, i) => { g.globalAlpha = ease(p * 3 - i * 0.35); g.fillStyle = '#fff'; g.fillRect(120, 520 + i * 150, W - 240, 120); g.fillStyle = C.ink; g.font = F('bold', 56); g.fillText(it, W / 2, 600 + i * 150); }); g.globalAlpha = 1;
      } else {
        g.fillStyle = C.mute; g.font = F('bold', 50); g.textAlign = 'center'; g.fillText('다음 이야기', W / 2, 640);
        g.fillStyle = C.ink; g.font = F('900', 76); s.text.split('\\n').forEach((l, i) => g.fillText(l, W / 2, 790 + i * 110));
        g.fillStyle = C.pri; g.fillRect(140, 1180, W - 280, 170); g.fillStyle = '#fff'; g.font = F('bold', 56); g.fillText('팔로우하고 다음 편 받기', W / 2, 1285);
      }
      g.fillStyle = C.ink; g.fillRect(0, H - 220, W, 220); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = F('bold', 50); g.fillText('무료 기출 CBT · 프로필 링크', W / 2, H - 120);
    }
    const stream = c.captureStream(FPS);
    if (VOICE) { const dest = ac.createMediaStreamDestination(); stream.addTrack(dest.stream.getAudioTracks()[0]); window.__dest = dest; }
    const type = (VOICE ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4'] : ['video/mp4;codecs=avc1.640028', 'video/mp4']).concat(['video/webm']).find(t => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
    frame(0); rec.start(500);
    const t0 = ac.currentTime + 0.1;
    if (VOICE) bufs.forEach((b, i) => { const src = ac.createBufferSource(); src.buffer = b; src.connect(window.__dest); src.start(t0 + starts[i] + 0.15); });
    await new Promise(done => { const tick = () => { const t = ac.currentTime - t0; frame(Math.max(0, t)); t < total ? setTimeout(tick, 1000 / FPS) : done(); }; tick(); });
    rec.stop(); await new Promise(r => rec.onstop = r);
    const buf = new Uint8Array(await new Blob(chunks, { type }).arrayBuffer());
    let str = ''; for (let i = 0; i < buf.length; i += 0x8000) str += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { type, b64: btoa(str), sec: total };
  })()`;
  const res = await cmd('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: 180000 });
  ws.close();
  const v = res.result?.result?.value;
  if (!v?.b64) throw new Error('녹화 실패: ' + JSON.stringify(res.result?.exceptionDetails ?? res).slice(0, 400));
  const out = path.join(outDir, `릴스-흐름${withVoice ? '' : '-무음'}.${v.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
  fs.writeFileSync(out, Buffer.from(v.b64, 'base64'));
  return { out, type: v.type, sec: Math.round(v.sec * 10) / 10, kb: Math.round(fs.statSync(out).size / 1024) };
}

try {
  console.log(JSON.stringify(await record(!process.argv.includes('--mute'))));
  console.log(JSON.stringify(await record(false)));
} finally {
  chrome.kill();
  await sleep(500);
  fs.rmSync(tmp, { recursive: true, force: true });
}
