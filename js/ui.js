// 여러 화면에서 함께 쓰는 화면 조각과 도우미
export const CIRCLED = ['①', '②', '③', '④', '⑤'];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 같은 주소를 다시 그려요 (app.js 가 hashchange 를 듣고 있어요).
export function refresh() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function goBack(fallback = '#/') {
  if (history.length > 1) history.back();
  else location.hash = fallback;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

export function confirmModal({ title, message = '', ok = '확인', cancel = '취소', danger = false }) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 id="modal-title">${esc(title)}</h2>
          ${message ? `<p class="muted">${esc(message)}</p>` : ''}
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-answer="no">${esc(cancel)}</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${esc(ok)}</button>
          </div>
        </div>
      </div>`;
    const backdrop = root.firstElementChild;
    backdrop.addEventListener('click', e => {
      const answer = e.target.closest('[data-answer]')?.dataset.answer;
      if (!answer && e.target !== backdrop) return;
      closeModal();
      resolve(answer === 'yes');
    });
    backdrop.querySelector('[data-answer="yes"]').focus();
  });
}

// 문제 카드: 시대·주제 태그, 문제, 보기 5개, (공개하면) 정답과 해설
export function questionHTML(q, { number = null, selected = null, revealed = false, showPoints = false, hideHead = false } = {}) {
  const choices = q.choices.map((text, i) => {
    const n = i + 1;
    const cls = ['choice'];
    if (selected === n) cls.push('is-selected');
    if (revealed && n === q.answer) cls.push('is-correct');
    if (revealed && selected === n && n !== q.answer) cls.push('is-wrong');
    return `<li><button type="button" class="${cls.join(' ')}" data-choice="${n}" ${revealed ? 'disabled' : ''}>
      <span class="choice-no">${CIRCLED[i]}</span><span>${esc(text)}</span></button></li>`;
  }).join('');
  const head = hideHead ? '' : `
    <div class="tags">
      <span class="tag">${esc(q.era)}</span>
      <span class="tag tag-soft">${esc(q.topic)}</span>
      ${showPoints ? `<span class="tag tag-soft">${q.points}점</span>` : ''}
    </div>
    <h3 class="question-text">${number ? `<span class="question-no">${number}.</span> ` : ''}${esc(q.question)}</h3>`;
  return `<div class="question">${head}<ol class="choices">${choices}</ol>${revealed ? explanationHTML(q, selected) : ''}</div>`;
}

export function explanationHTML(q, selected) {
  const answer = CIRCLED[q.answer - 1];
  let title = `정답 ${answer}`;
  let cls = '';
  if (selected != null) {
    const ok = selected === q.answer;
    title = ok ? '정답이에요! 🎉' : `아쉬워요. 정답은 ${answer}`;
    cls = ok ? 'is-ok' : 'is-bad';
  }
  return `<div class="explain ${cls}"><strong>${title}</strong><p>${esc(q.explanation)}</p></div>`;
}

// 가로 막대 한 줄 (분석·시험 결과)
export function barRowHTML(label, ratio, value, { weak = false, tip = '' } = {}) {
  const width = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return `<div class="bar-row" title="${esc(tip || `${label}: ${value}`)}">
    <span class="bar-label">${esc(label)}${weak ? '<span class="weak-label">약점</span>' : ''}</span>
    <span class="bar-track"><span class="bar-fill ${weak ? 'is-weak' : ''}" style="width:${width}%"></span></span>
    <span class="bar-value">${esc(value)}</span>
  </div>`;
}

// ── 홈 화면에 설치 (안드로이드 크롬은 설치 창, 아이폰은 안내 문구) ──
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  document.dispatchEvent(new Event('installable'));
});
window.addEventListener('appinstalled', () => { installPrompt = null; });

export function installInfo() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { standalone, ios, canPrompt: installPrompt != null };
}

export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  return outcome === 'accepted';
}
