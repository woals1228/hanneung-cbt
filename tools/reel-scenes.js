// 릴스 '그림 장면'을 코드로 그려요(외부 이미지·유료 API 없이). insta-story-reel.mjs가 이 파일을 페이지에 넣어 써요.
// 장면에 "draw": "palace-spring" | "ondol" | "kitchen" | "hall" 을 주면 배경과 인물이 그려지고 살짝 움직여요.
// paint(g, key, t, p): g=캔버스, t=영상 전체 시간(초), p=장면 안 시간(초). 인물은 자막 판(y≥1180) 위쪽에 그려요.
function paint(g, key, t, p) {
  const W = 1080, H = 1920;
  const lin = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const circle = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const breathe = Math.sin(t * 2) * 4;
  // 기와지붕: 양 끝이 들린 곡선 지붕
  const roof = (cx, y, w, h, c) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(cx - w / 2 - 40, y - 30);
    g.quadraticCurveTo(cx - w / 4, y + 10, cx, y + 8); g.quadraticCurveTo(cx + w / 4, y + 10, cx + w / 2 + 40, y - 30);
    g.lineTo(cx + w / 2 - 30, y + h); g.lineTo(cx - w / 2 + 30, y + h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = -w / 2 + 40; i < w / 2 - 30; i += 26) g.fillRect(cx + i, y + 14, 6, h - 18);
  };
  // 한복 입은 사람(앞모습). who: 'woman' | 'man' | 'king'
  const person = (x, y, s, who, opt = {}) => {
    g.save(); g.translate(x, y + breathe * (opt.still ? 0 : 1)); g.scale(s, s);
    const skin = '#f1d3b6';
    if (who === 'woman') {
      g.fillStyle = opt.skirt ?? '#8fc6e6'; g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(-150, 260, -130, 330); g.lineTo(130, 330); g.quadraticCurveTo(150, 260, 40, 0); g.fill();
      rect(-55, -70, 110, 80, opt.top ?? '#fbf6ec'); rect(-6, -40, 12, 70, '#3a3f5c');
    } else if (who === 'man') {
      rect(-45, 60, 40, 270, '#e9e2d3'); rect(5, 60, 40, 270, '#e9e2d3');
      rect(-60, -70, 120, 150, opt.top ?? '#d8cdb8'); rect(-60, 40, 120, 14, '#6b5d4a');
    } else {
      g.fillStyle = '#b3262b'; g.beginPath(); g.moveTo(-70, -70); g.lineTo(70, -70); g.lineTo(110, 330); g.lineTo(-110, 330); g.fill();
      circle(0, 10, 34, '#e6b84a'); rect(-80, 90, 160, 14, '#3b2a1a');
    }
    circle(0, -120, 52, skin);
    if (who === 'woman') { g.fillStyle = '#2b2622'; g.beginPath(); g.arc(0, -132, 54, Math.PI, 0); g.fill(); circle(0, -182, 24, '#2b2622'); }
    if (who === 'man') { g.fillStyle = '#2b2622'; g.beginPath(); g.arc(0, -130, 53, Math.PI, 0); g.fill(); circle(0, -190, 16, '#2b2622'); }
    if (who === 'king') { rect(-48, -210, 96, 70, '#1d1d1d'); rect(-62, -150, 124, 14, '#1d1d1d'); }
    circle(-18, -118, 5, '#3a2e26'); circle(18, -118, 5, '#3a2e26');
    g.strokeStyle = '#a5614c'; g.lineWidth = 4; g.beginPath(); g.arc(0, -104, 12, 0.2, Math.PI - 0.2); g.stroke();
    if (opt.baby) { g.fillStyle = '#fffaf2'; g.beginPath(); g.ellipse(0, 10, 70, 46, -0.3, 0, 7); g.fill(); circle(-30, -2, 22, skin); }
    if (opt.belly) { g.fillStyle = opt.top ?? '#fbf6ec'; g.beginPath(); g.ellipse(18, 30, 46, 40, 0, 0, 7); g.fill(); }
    g.restore();
  };

  if (key === 'palace-spring') {
    rect(0, 0, W, H, lin(0, 1100, '#bfe0f2', '#fde4ec'));
    g.fillStyle = '#a9c4a0'; g.beginPath(); g.moveTo(0, 760); g.quadraticCurveTo(300, 560, 600, 720); g.quadraticCurveTo(850, 600, W, 700); g.lineTo(W, 900); g.lineTo(0, 900); g.fill();
    roof(W / 2, 640, 860, 120, '#4a4f57'); rect(160, 760, 760, 260, '#efe3cf');
    for (const x of [200, 400, 660, 860]) rect(x, 760, 26, 260, '#a23b32');
    rect(0, 1020, W, 900, lin(1020, H, '#e9e1d2', '#d8ccb6'));
    person(W / 2, 880, 0.9, 'woman', { belly: true });
    g.fillStyle = 'rgba(244,160,185,0.9)'; for (let i = 0; i < 40; i++) { const x = (i * 271 + t * 40) % W, y = (i * 613 + t * 90) % 1180; g.beginPath(); g.ellipse(x, y, 10, 6, t + i, 0, 7); g.fill(); }
  } else if (key === 'ondol') {
    rect(0, 0, W, H, '#e8d3b0');
    const glow = 0.85 + Math.sin(t * 1.5) * 0.08;
    rect(620, 330, 330, 440, `rgba(255,236,170,${glow})`); g.strokeStyle = '#8a6a44'; g.lineWidth = 8; g.strokeRect(620, 330, 330, 440);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(620 + i * 82, 330); g.lineTo(620 + i * 82, 770); g.moveTo(620, 330 + i * 110); g.lineTo(950, 330 + i * 110); g.stroke(); }
    rect(0, 1000, W, 920, '#c99a5b'); rect(120, 1000, 840, 40, '#e8b96a');
    g.fillStyle = 'rgba(255,230,160,0.25)'; g.beginPath(); g.moveTo(620, 770); g.lineTo(950, 770); g.lineTo(700, 1180); g.lineTo(200, 1180); g.fill();
    person(420, 860, 0.95, 'woman', { baby: true, skirt: '#f2b8c6' });
  } else if (key === 'kitchen') {
    rect(0, 0, W, H, '#8a6b52'); rect(0, 1000, W, 920, '#5b4636');
    g.fillStyle = '#7a4a2e'; g.beginPath(); g.moveTo(560, 1000); g.lineTo(560, 820); g.quadraticCurveTo(760, 700, 960, 820); g.lineTo(960, 1000); g.fill();
    const f = 1 + Math.sin(t * 9) * 0.15; g.fillStyle = '#ff9a3c'; g.beginPath(); g.ellipse(760, 960, 70 * f, 40 * f, 0, 0, 7); g.fill(); circle(760, 965, 26 * f, '#ffd36b');
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.ellipse(760, 800, 150, 46, 0, 0, 7); g.fill(); rect(610, 760, 300, 40, '#2a2a2a');
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 10; for (let i = 0; i < 3; i++) { const o = (t * 60 + i * 80) % 240; g.beginPath(); g.moveTo(700 + i * 60, 740 - o); g.quadraticCurveTo(730 + i * 60 + Math.sin(t * 3 + i) * 30, 700 - o, 700 + i * 60, 660 - o); g.stroke(); }
    person(340, 880, 0.95, 'man');
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 12; g.beginPath(); g.moveTo(420, 860); g.lineTo(700 + Math.sin(t * 4) * 20, 760); g.stroke();
  } else if (key === 'hall') {
    rect(0, 0, W, H, '#3b2a22');
    rect(110, 300, 860, 560, '#1f4e79'); circle(260, 400, 60, '#f3d36b'); circle(820, 400, 50, '#e6e6e6');
    g.fillStyle = '#2e6b4a'; g.beginPath(); g.moveTo(110, 860); for (const [x, y] of [[230, 560], [360, 760], [540, 500], [720, 760], [850, 560], [970, 860]]) g.lineTo(x, y); g.fill();
    for (const x of [60, 990]) rect(x, 200, 34, 900, '#a23b32');
    rect(0, 1000, W, 920, '#6b4a2e');
    person(W / 2, 760, 0.95, 'king', { still: false });
    rect(250, 950, 580, 60, '#5a3a22'); rect(280, 1010, 30, 160, '#5a3a22'); rect(770, 1010, 30, 160, '#5a3a22');
    rect(340, 930, 160, 22, '#f5efe0'); rect(560, 930, 160, 22, '#f5efe0');
    // 측우기: 받침돌 위 원통
    rect(880, 980, 120, 50, '#9a958c'); rect(905, 860, 70, 120, '#4f6f8a'); rect(900, 880, 80, 8, '#3b5266'); rect(900, 930, 80, 8, '#3b5266');
  }
}
